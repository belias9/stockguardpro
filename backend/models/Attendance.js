/**
 * Attendance Model
 * One record per employee per day.
 * Biometric verification via assigned device.
 */
const mongoose = require('mongoose');

const ATTENDANCE_STATUS = ['present', 'absent', 'late', 'on_leave', 'half_day', 'early_departure'];

const attendanceSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // ============ Date ============
    date: { type: Date, required: true, index: true },  // normalized to midnight (local)

    // ============ Clock in ============
    clockIn: {
        time: { type: Date, default: null },
        deviceId: { type: String, default: null },
        deviceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },
        fingerprintVerified: { type: Boolean, default: false },
        faceVerified: { type: Boolean, default: false },
        ipAddress: { type: String, default: null },
        method: { type: String, enum: ['fingerprint', 'face', 'manual', 'web'], default: 'fingerprint' },
        location: {
            latitude: Number,
            longitude: Number
        }
    },

    // ============ Clock out ============
    clockOut: {
        time: { type: Date, default: null },
        deviceId: { type: String, default: null },
        deviceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },
        fingerprintVerified: { type: Boolean, default: false },
        faceVerified: { type: Boolean, default: false },
        ipAddress: { type: String, default: null },
        method: { type: String, enum: ['fingerprint', 'face', 'manual', 'web'], default: 'fingerprint' }
    },

    // ============ Status ============
    status: { type: String, enum: ATTENDANCE_STATUS, default: 'absent', index: true },

    // ============ Working hours ============
    workingHours: {
        expectedStart: { type: String, default: '08:00' },
        expectedEnd: { type: String, default: '17:00' },
        actualStart: { type: String, default: null },
        actualEnd: { type: String, default: null },
        totalHours: { type: Number, default: 0, min: 0 },
        overtimeHours: { type: Number, default: 0, min: 0 },
        lateMinutes: { type: Number, default: 0, min: 0 },
        earlyDepartureMinutes: { type: Number, default: 0, min: 0 }
    },

    // ============ Absence ============
    absenceReason: {
        reason: { type: String, default: null },
        documentUrl: { type: String, default: null },
        submittedAt: Date,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        reviewNotes: String,
        reviewedAt: Date
    },

    // ============ Salary impact ============
    salaryImpact: {
        deductionAmount: { type: Number, default: 0 },
        deductionPercentage: { type: Number, default: 0 },
        applied: { type: Boolean, default: false }
    },

    // ============ Notes ============
    notes: { type: String, default: '' },

    // ============ Metadata ============
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ============================================================
// Indexes
// ============================================================
// Unique: one record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

// Query: today's attendance for a branch
attendanceSchema.index({ branch: 1, date: -1, status: 1 });

// Query: attendance history for employee
attendanceSchema.index({ employee: 1, date: -1 });

// Query: attendance by company + date range
attendanceSchema.index({ company: 1, date: -1 });

// ============================================================
// Pre-save: normalize date to midnight + update timestamp
// ============================================================
attendanceSchema.pre('save', function (next) {
    if (this.date) {
        const d = new Date(this.date);
        d.setHours(0, 0, 0, 0);
        this.date = d;
    }
    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Method: record clock in
// ============================================================
attendanceSchema.methods.recordClockIn = function ({ deviceId, deviceRef, fingerprintVerified, faceVerified, ipAddress, method, expectedStart }) {
    if (this.clockIn?.time) throw new Error('Already clocked in today');

    const now = new Date();
    const start = expectedStart || '08:00';
    const [h, m] = start.split(':').map(Number);
    const expected = new Date(now);
    expected.setHours(h, m, 0, 0);

    let lateMinutes = 0;
    if (now > expected) {
        lateMinutes = Math.floor((now - expected) / 60000);
    }

    this.clockIn = {
        time: now,
        deviceId,
        deviceRef,
        fingerprintVerified: !!fingerprintVerified,
        faceVerified: !!faceVerified,
        ipAddress,
        method: method || 'fingerprint'
    };

    this.workingHours.expectedStart = start;
    this.workingHours.actualStart = now.toTimeString().slice(0, 5);
    this.workingHours.lateMinutes = lateMinutes;

    this.status = lateMinutes > 15 ? 'late' : 'present';
};

// ============================================================
// Method: record clock out
// ============================================================
attendanceSchema.methods.recordClockOut = function ({ deviceId, deviceRef, fingerprintVerified, faceVerified, ipAddress, method, expectedEnd }) {
    if (!this.clockIn?.time) throw new Error('Cannot clock out without clocking in');
    if (this.clockOut?.time) throw new Error('Already clocked out today');

    const now = new Date();
    const end = expectedEnd || '17:00';
    const [h, m] = end.split(':').map(Number);
    const expected = new Date(now);
    expected.setHours(h, m, 0, 0);

    let earlyDeparture = 0;
    if (now < expected) {
        earlyDeparture = Math.floor((expected - now) / 60000);
    }

    this.clockOut = {
        time: now,
        deviceId,
        deviceRef,
        fingerprintVerified: !!fingerprintVerified,
        faceVerified: !!faceVerified,
        ipAddress,
        method: method || 'fingerprint'
    };

    this.workingHours.expectedEnd = end;
    this.workingHours.actualEnd = now.toTimeString().slice(0, 5);
    this.workingHours.earlyDepartureMinutes = earlyDeparture;

    const totalHours = (now - this.clockIn.time) / (1000 * 60 * 60);
    this.workingHours.totalHours = parseFloat(totalHours.toFixed(2));

    // Overtime if > 8 hours
    if (totalHours > 8) {
        this.workingHours.overtimeHours = parseFloat((totalHours - 8).toFixed(2));
    }

    if (earlyDeparture > 15) {
        this.status = 'early_departure';
    }
};

// ============================================================
// Role-aware serialization
// ============================================================
attendanceSchema.methods.toPublicJSON = function () {
    return {
        id: this._id,
        employee: this.employee,
        date: this.date,
        status: this.status,
        clockIn: {
            time: this.clockIn.time,
            fingerprintVerified: this.clockIn.fingerprintVerified,
            faceVerified: this.clockIn.faceVerified,
            method: this.clockIn.method
        },
        clockOut: {
            time: this.clockOut.time,
            fingerprintVerified: this.clockOut.fingerprintVerified,
            faceVerified: this.clockOut.faceVerified,
            method: this.clockOut.method
        },
        workingHours: this.workingHours,
        salaryImpact: this.salaryImpact,
        createdAt: this.createdAt
    };
};

attendanceSchema.set('toJSON', { virtuals: true });
attendanceSchema.set('toObject', { virtuals: true });

attendanceSchema.statics.ATTENDANCE_STATUS = ATTENDANCE_STATUS;

module.exports = mongoose.model('Attendance', attendanceSchema);