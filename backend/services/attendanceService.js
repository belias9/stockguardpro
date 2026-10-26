/**
 * Attendance Service
 * Clock in/out with biometric verification.
 */
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Device = require('../models/Device');
const Company = require('../models/Company');
const auditHelper = require('../utils/auditHelper');

// ============================================================
// Clock in (public — requires device key)
// ============================================================
async function clockIn(req, data) {
    const {
        employeeId, companyId, deviceId,
        fingerprintTemplate, faceTemplate,
        fingerprintVerified, faceVerified,
        method = 'fingerprint',
        location
    } = data;

    if (!employeeId || !companyId || !deviceId) {
        throw { status: 400, message: 'employeeId, companyId, and deviceId required' };
    }

    // Find employee
    const employee = await User.findOne({
        _id: employeeId,
        company: companyId,
        isActive: true,
        accountClosed: false
    });
    if (!employee) throw { status: 404, message: 'Employee not found or inactive' };

    // Find device
    const device = await Device.findOne({
        company: companyId,
        deviceId,
        isActive: true
    }).select('+apiKey');
    if (!device) throw { status: 404, message: 'Device not registered or inactive' };

    // Verify device API key (header)
    const deviceKey = req.headers['x-device-key'];
    if (!deviceKey) {
        throw { status: 401, message: 'Device key missing' };
    }
    const validKey = await device.verifyApiKey(deviceKey);
    if (!validKey) {
        throw { status: 401, message: 'Invalid device key' };
    }

    // Biometric verification (either fingerprint OR face)
    if (fingerprintTemplate) {
        const match = await employee.verifyBiometric(fingerprintTemplate, 'fingerprint');
        if (!match) throw { status: 401, message: 'Fingerprint does not match' };
    } else if (faceTemplate) {
        const match = await employee.verifyBiometric(faceTemplate, 'face');
        if (!match) throw { status: 401, message: 'Face does not match' };
    } else if (!fingerprintVerified && !faceVerified) {
        throw { status: 401, message: 'Biometric verification required' };
    }

    // Get company settings
    const company = await Company.findById(companyId);
    const expectedStart = company.settings?.workingHours?.start || '08:00';
    const expectedEnd = company.settings?.workingHours?.end || '17:00';

    // Today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check existing
    let attendance = await Attendance.findOne({
        employee: employeeId,
        date: today
    });

    if (attendance && attendance.clockIn?.time) {
        throw { status: 400, message: 'Already clocked in today' };
    }

    if (!attendance) {
        attendance = new Attendance({
            company: companyId,
            branch: employee.branch,
            employee: employeeId,
            date: today
        });
    }

    attendance.recordClockIn({
        deviceId,
        deviceRef: device._id,
        fingerprintVerified: !!fingerprintTemplate || !!fingerprintVerified,
        faceVerified: !!faceTemplate || !!faceVerified,
        ipAddress: req.ip,
        method,
        expectedStart
    });

    await attendance.save();

    // Update device last seen
    await device.markSeen(req.ip);

    await auditHelper.log(req, {
        action: 'ATTENDANCE_CLOCK_IN',
        entityType: 'Attendance',
        entityId: attendance._id,
        entityName: `${employee.firstName} ${employee.lastName}`,
        company: companyId,
        branch: employee.branch
    });

    return {
        attendance: attendance.toPublicJSON(),
        message: attendance.status === 'late'
            ? `You are ${attendance.workingHours.lateMinutes} minutes late`
            : 'Clocked in successfully'
    };
}

// ============================================================
// Clock out (public — requires device key)
// ============================================================
async function clockOut(req, data) {
    const {
        employeeId, companyId, deviceId,
        fingerprintTemplate, faceTemplate,
        fingerprintVerified, faceVerified,
        method = 'fingerprint'
    } = data;

    if (!employeeId || !companyId || !deviceId) {
        throw { status: 400, message: 'employeeId, companyId, and deviceId required' };
    }

    const employee = await User.findOne({
        _id: employeeId,
        company: companyId,
        isActive: true
    });
    if (!employee) throw { status: 404, message: 'Employee not found' };

    const device = await Device.findOne({
        company: companyId,
        deviceId,
        isActive: true
    }).select('+apiKey');
    if (!device) throw { status: 404, message: 'Device not registered or inactive' };

    const deviceKey = req.headers['x-device-key'];
    if (!deviceKey || !(await device.verifyApiKey(deviceKey))) {
        throw { status: 401, message: 'Invalid device key' };
    }

    // Biometric
    if (fingerprintTemplate) {
        const match = await employee.verifyBiometric(fingerprintTemplate, 'fingerprint');
        if (!match) throw { status: 401, message: 'Fingerprint does not match' };
    } else if (faceTemplate) {
        const match = await employee.verifyBiometric(faceTemplate, 'face');
        if (!match) throw { status: 401, message: 'Face does not match' };
    } else if (!fingerprintVerified && !faceVerified) {
        throw { status: 401, message: 'Biometric verification required' };
    }

    const company = await Company.findById(companyId);
    const expectedEnd = company.settings?.workingHours?.end || '17:00';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
        employee: employeeId,
        date: today
    });
    if (!attendance) throw { status: 400, message: 'No clock-in found for today' };

    if (attendance.clockOut?.time) {
        throw { status: 400, message: 'Already clocked out today' };
    }

    attendance.recordClockOut({
        deviceId,
        deviceRef: device._id,
        fingerprintVerified: !!fingerprintTemplate || !!fingerprintVerified,
        faceVerified: !!faceTemplate || !!faceVerified,
        ipAddress: req.ip,
        method,
        expectedEnd
    });

    await attendance.save();

    await auditHelper.log(req, {
        action: 'ATTENDANCE_CLOCK_OUT',
        entityType: 'Attendance',
        entityId: attendance._id,
        entityName: `${employee.firstName} ${employee.lastName}`,
        company: companyId,
        branch: employee.branch
    });

    return {
        attendance: attendance.toPublicJSON(),
        message: attendance.workingHours.earlyDepartureMinutes > 0
            ? `Early departure by ${attendance.workingHours.earlyDepartureMinutes} minutes`
            : 'Clocked out successfully'
    };
}

// ============================================================
// Get today's attendance (Employer/Manager)
// ============================================================
async function getToday(req) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const query = {
        company: req.user.company,
        date: { $gte: today, $lt: tomorrow }
    };

    if (req.user.role !== 'employer') query.branch = req.user.branch;
    else if (req.branch) query.branch = req.branch;

    const attendances = await Attendance.find(query)
        .populate('employee', 'firstName lastName employeeId')
        .populate('branch', 'name code');

    // Get all active employees
    const employeeQuery = {
        company: req.user.company,
        role: 'employee',
        isActive: true,
        accountClosed: false
    };
    if (req.user.role !== 'employer') employeeQuery.branch = req.user.branch;
    else if (req.branch) employeeQuery.branch = req.branch;

    const allEmployees = await User.find(employeeQuery).select('firstName lastName employeeId');

    const presentIds = attendances.filter(a => a.status === 'present' || a.status === 'late').map(a => a.employee?._id.toString());
    const notYetClocked = allEmployees.filter(e => !presentIds.includes(e._id.toString()));

    return {
        present: attendances.filter(a => a.status === 'present'),
        late: attendances.filter(a => a.status === 'late'),
        absent: attendances.filter(a => a.status === 'absent'),
        onLeave: attendances.filter(a => a.status === 'on_leave'),
        earlyDeparture: attendances.filter(a => a.status === 'early_departure'),
        notYetClocked,
        totalEmployees: allEmployees.length
    };
}

// ============================================================
// Get employee attendance history
// ============================================================
async function getEmployeeAttendance(req, employeeId, query) {
    const { month, year } = query;

    // Self or employer/manager only
    if (req.user.role === 'employee' && req.user._id.toString() !== employeeId) {
        throw { status: 403, message: 'Not authorized' };
    }

    // Verify employee
    const employee = await User.findOne({ _id: employeeId, company: req.user.company });
    if (!employee) throw { status: 404, message: 'Employee not found' };

    let dateQuery = {};
    if (month && year) {
        const start = new Date(parseInt(year), parseInt(month) - 1, 1);
        const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        dateQuery = { $gte: start, $lte: end };
    }

    const attendances = await Attendance.find({
        employee: employeeId,
        company: req.user.company,
        ...(Object.keys(dateQuery).length > 0 && { date: dateQuery })
    }).sort({ date: -1 });

    const summary = {
        totalDays: attendances.length,
        present: attendances.filter(a => a.status === 'present').length,
        absent: attendances.filter(a => a.status === 'absent').length,
        late: attendances.filter(a => a.status === 'late').length,
        onLeave: attendances.filter(a => a.status === 'on_leave').length,
        halfDay: attendances.filter(a => a.status === 'half_day').length,
        earlyDeparture: attendances.filter(a => a.status === 'early_departure').length,
        totalWorkingHours: attendances.reduce((s, a) => s + (a.workingHours.totalHours || 0), 0),
        totalLateMinutes: attendances.reduce((s, a) => s + (a.workingHours.lateMinutes || 0), 0)
    };

    return {
        attendances: attendances.map(a => a.toPublicJSON()),
        summary
    };
}

// ============================================================
// Submit absence reason (employee — self)
// ============================================================
async function submitAbsenceReason(req, data) {
    const { date, reason, documentUrl } = data;
    if (!date || !reason) {
        throw { status: 400, message: 'Date and reason required' };
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({
        employee: req.user._id,
        date: attendanceDate
    });

    if (!attendance) {
        attendance = new Attendance({
            company: req.user.company,
            branch: req.user.branch,
            employee: req.user._id,
            date: attendanceDate,
            status: 'absent'
        });
    }

    attendance.absenceReason = {
        reason,
        documentUrl: documentUrl || '',
        submittedAt: new Date(),
        reviewStatus: 'pending'
    };

    await attendance.save();

    return attendance.toPublicJSON();
}

// ============================================================
// Auto-mark absent (cron — runs at 23:59)
// ============================================================
async function autoMarkAbsent() {
    const logger = require('../utils/logger');
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const companies = await Company.find({ isActive: true });
        let marked = 0;

        for (const company of companies) {
            const employees = await User.find({
                company: company._id,
                role: 'employee',
                isActive: true,
                accountClosed: false
            });

            for (const employee of employees) {
                const existing = await Attendance.findOne({
                    employee: employee._id,
                    date: { $gte: today, $lt: tomorrow }
                });

                if (!existing) {
                    await Attendance.create({
                        company: company._id,
                        branch: employee.branch,
                        employee: employee._id,
                        date: today,
                        status: 'absent'
                    });
                    marked++;
                } else if (!existing.clockIn?.time && existing.status !== 'on_leave') {
                    existing.status = 'absent';
                    await existing.save();
                    marked++;
                }
            }
        }

        logger.info(`[Attendance] Auto-marked ${marked} employees as absent`);
        return { marked };
    } catch (err) {
        logger.error('[Attendance] Auto-mark failed:', err.message);
        throw err;
    }
}

module.exports = {
    clockIn, clockOut, getToday, getEmployeeAttendance,
    submitAbsenceReason, autoMarkAbsent
};