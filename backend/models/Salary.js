/**
 * Salary Model
 * One record per employee per month.
 * Calculated from attendance + bonuses + deductions.
 */
const mongoose = require('mongoose');

const DEDUCTION_TYPES = ['absence', 'late', 'advance', 'loan', 'tax', 'pension', 'insurance', 'other'];
const PAYMENT_STATUS = ['pending', 'processing', 'paid', 'failed', 'disputed'];
const DISPUTE_STATUS = ['open', 'resolved', 'rejected'];

const salarySchema = new mongoose.Schema({
    // ============ Tenant ============
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // ============ Period ============
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    period: { type: String, required: true },  // YYYY-MM (unique per employee)

    // ============ Base ============
    baseSalary: { type: Number, required: true, min: 0 },

    // ============ Attendance summary ============
    attendanceSummary: {
        totalDays: { type: Number, default: 0 },
        presentDays: { type: Number, default: 0 },
        absentDays: { type: Number, default: 0 },
        lateDays: { type: Number, default: 0 },
        halfDays: { type: Number, default: 0 },
        leaveDays: { type: Number, default: 0 },
        overtimeHours: { type: Number, default: 0 }
    },

    // ============ Earnings ============
    earnings: {
        basePay: { type: Number, default: 0 },
        overtimePay: { type: Number, default: 0 },
        bonus: { type: Number, default: 0 },
        allowances: { type: Number, default: 0 },
        commission: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 }
    },

    // ============ Deductions ============
    deductions: [{
        type: { type: String, enum: DEDUCTION_TYPES, required: true },
        description: { type: String, default: '' },
        amount: { type: Number, required: true, min: 0 },
        percentage: { type: Number, default: 0 },
        date: { type: Date, default: Date.now },
        reference: String
    }],
    totalDeductions: { type: Number, default: 0 },

    // ============ Advances ============
    advances: [{
        advanceId: { type: mongoose.Schema.Types.ObjectId },
        amount: { type: Number, required: true, min: 0 },
        date: { type: Date, required: true },
        reason: { type: String, default: '' },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    totalAdvances: { type: Number, default: 0 },

    // ============ Net ============
    netSalary: { type: Number, default: 0 },

    // ============ Payment ============
    payment: {
        status: { type: String, enum: PAYMENT_STATUS, default: 'pending', index: true },
        paidAt: { type: Date, default: null },
        paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        paidByName: { type: String, default: null },
                paymentMethod: { 
            type: String, 
            enum: {
                values: ['bank_transfer', 'cash', 'check', 'mobile_money', 'other', null],
                message: 'Invalid payment method'
            },
            default: null 
        },
        transactionReference: { type: String, default: null },
        bankAccount: { type: String, default: null },
        bankName: { type: String, default: null }
    },

    // ============ Bonus approval ============
    bonusApproval: {
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        addedByName: { type: String, default: null },
        addedAt: { type: Date, default: null },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        approvedByName: { type: String, default: null },
        approvedAt: { type: Date, default: null },
        status: { type: String, enum: ['not_required', 'pending', 'approved', 'rejected'], default: 'not_required' }
    },

    // ============ Payslip ============
    payslip: {
        generatedAt: { type: Date, default: null },
        generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        pdfUrl: { type: String, default: null },
        sentToEmployee: { type: Boolean, default: false }
    },

    // ============ Disputes ============
    employeeConfirmation: {
        confirmed: { type: Boolean, default: false },
        confirmedAt: Date,
        disputes: [{
            issue: { type: String, required: true },
            submittedAt: { type: Date, default: Date.now },
            status: { type: String, enum: DISPUTE_STATUS, default: 'open' },
            resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            resolvedByName: String,
            resolution: String,
            resolvedAt: Date
        }]
    },

    // ============ Warnings ============
    warnings: {
        type: [String],
        default: []
        // e.g., "3 days had no attendance record — treated as absent"
    },

    // ============ Notes ============
    notes: { type: String, default: '' },

    // ============ Metadata ============
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ============================================================
// Indexes
// ============================================================
// Unique: one salary per employee per period
salarySchema.index({ employee: 1, period: 1 }, { unique: true });

salarySchema.index({ company: 1, period: 1 });
salarySchema.index({ branch: 1, period: 1 });
salarySchema.index({ 'payment.status': 1, company: 1 });
salarySchema.index({ period: 1, 'payment.status': 1 });

// ============================================================
// Pre-save: recalculate totals
// ============================================================
// Run BEFORE validation so required fields are set
salarySchema.pre('validate', function (next) {
    // Ensure period is set before validation
    if (this.month && this.year) {
        this.period = `${this.year}-${String(this.month).padStart(2, '0')}`;
    }
    next();
});

// Run BEFORE save to recalculate totals
salarySchema.pre('save', function (next) {
    // Total earnings
    this.earnings.totalEarnings =
        (this.earnings.basePay || 0) +
        (this.earnings.overtimePay || 0) +
        (this.earnings.bonus || 0) +
        (this.earnings.allowances || 0) +
        (this.earnings.commission || 0);

    // Total deductions
    this.totalDeductions = this.deductions.reduce((s, d) => s + (d.amount || 0), 0);

    // Total advances
    this.totalAdvances = this.advances.reduce((s, a) => s + (a.amount || 0), 0);

    // Net salary
    this.netSalary = this.earnings.totalEarnings - this.totalDeductions - this.totalAdvances;

    // Ensure period matches month/year
    this.period = `${this.year}-${String(this.month).padStart(2, '0')}`;

    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Method: mark as paid
// ============================================================
salarySchema.methods.markPaid = function (user, { paymentMethod, transactionReference, bankAccount, bankName }) {
    if (this.payment.status === 'paid') throw new Error('Salary already paid');
    if (this.payment.status === 'disputed') throw new Error('Salary under dispute — cannot pay');

    this.payment.status = 'paid';
    this.payment.paidAt = new Date();
    this.payment.paidBy = user._id;
    this.payment.paidByName = `${user.firstName} ${user.lastName}`;
    this.payment.paymentMethod = paymentMethod || 'bank_transfer';
    this.payment.transactionReference = transactionReference || null;
    this.payment.bankAccount = bankAccount || null;
    this.payment.bankName = bankName || null;
};

// ============================================================
// Method: submit dispute
// ============================================================
salarySchema.methods.submitDispute = function (issue) {
    if (this.payment.status === 'paid') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (this.payment.paidAt && this.payment.paidAt < thirtyDaysAgo) {
            throw new Error('Cannot dispute a salary paid more than 30 days ago');
        }
    }

    this.employeeConfirmation.disputes.push({
        issue,
        submittedAt: new Date(),
        status: 'open'
    });
    this.employeeConfirmation.confirmed = false;
    this.payment.status = 'disputed';
};

// ============================================================
// Role-aware serialization
// ============================================================
salarySchema.methods.toPublicJSON = function (viewerRole = 'employee') {
    const base = {
        id: this._id,
        period: this.period,
        month: this.month,
        year: this.year,
        baseSalary: this.baseSalary,
        attendanceSummary: this.attendanceSummary,
        earnings: this.earnings,
        deductions: this.deductions,
        totalDeductions: this.totalDeductions,
        advances: this.advances,
        totalAdvances: this.totalAdvances,
        netSalary: this.netSalary,
        payment: {
            status: this.payment.status,
            paidAt: this.payment.paidAt,
            paymentMethod: this.payment.paymentMethod,
            transactionReference: this.payment.transactionReference
        },
        bonusApproval: this.bonusApproval,
        employeeConfirmation: this.employeeConfirmation,
        warnings: this.warnings,
        createdAt: this.createdAt
    };

    if (['employer', 'manager'].includes(viewerRole)) {
        base.employee = this.employee;
        base.branch = this.branch;
        base.payment = this.payment;  // full payment details
        base.generatedBy = this.generatedBy;
    }

    return base;
};

salarySchema.set('toJSON', { virtuals: true });
salarySchema.set('toObject', { virtuals: true });

salarySchema.statics.DEDUCTION_TYPES = DEDUCTION_TYPES;
salarySchema.statics.PAYMENT_STATUS = PAYMENT_STATUS;

module.exports = mongoose.model('Salary', salarySchema);