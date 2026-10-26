/**
 * Salary Service
 * Generate, review, pay, dispute, advance, bonus approval.
 */
const Salary = require('../models/Salary');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Company = require('../models/Company');
const auditHelper = require('../utils/auditHelper');

// ============================================================
// Get working days in month based on company settings
// ============================================================
function getWorkingDaysInMonth(year, month, workingDays) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        if (workingDays.includes(dayNames[date.getDay()])) count++;
    }
    return count;
}

// ============================================================
// Generate salaries
// ============================================================
async function generateSalaries(req, data) {
    const { month, year, branchId } = data;
    if (!month || !year) throw { status: 400, message: 'Month and year required' };

    const period = `${year}-${String(month).padStart(2, '0')}`;

    // Scope
    let employeeFilter = {
        company: req.user.company,
        role: 'employee',
        isActive: true,
        accountClosed: false
    };

    if (req.user.role === 'employer') {
        if (branchId) employeeFilter.branch = branchId;
    } else if (req.user.activeRoles?.includes('manager')) {
        employeeFilter.branch = req.user.branch;
    } else {
        throw { status: 403, message: 'Only employer or manager can generate salaries' };
    }

    const company = await Company.findById(req.user.company);
    const employees = await User.find(employeeFilter);

    const generated = [];
    const errors = [];

    for (const employee of employees) {
        try {
            // Skip if already exists
            const existing = await Salary.findOne({ employee: employee._id, period });
            if (existing) {
                errors.push({ employee: employee.fullName, error: 'Already generated for this period' });
                continue;
            }

            // Attendance
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            const attendances = await Attendance.find({
                employee: employee._id,
                company: req.user.company,
                date: { $gte: startDate, $lte: endDate }
            });

            const presentDays = attendances.filter(a => a.status === 'present').length;
            const absentDays = attendances.filter(a => a.status === 'absent').length;
            const lateDays = attendances.filter(a => a.status === 'late').length;
            const halfDays = attendances.filter(a => a.status === 'half_day').length;
            const leaveDays = attendances.filter(a => a.status === 'on_leave').length;
            const overtimeHours = attendances.reduce((s, a) => s + (a.workingHours?.overtimeHours || 0), 0);
            const totalDays = attendances.length;

            const workingDaysInMonth = getWorkingDaysInMonth(year, month, company.settings.workingDays);
            const dailyRate = workingDaysInMonth > 0 ? employee.baseSalary / workingDaysInMonth : 0;
            const daysWorked = presentDays + (halfDays * 0.5) + leaveDays;
            const basePay = Math.round(dailyRate * daysWorked);

            const hourlyRate = workingDaysInMonth > 0 ? employee.baseSalary / (workingDaysInMonth * 8) : 0;
            const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5);

            // Deductions
            const deductions = [];
            let totalDeductions = 0;

            if (absentDays > 0 && company.settings.autoDeductAbsence) {
                const absenceDeduction = Math.round(dailyRate * absentDays * (company.settings.absenceDeductionRate || 0.1));
                deductions.push({
                    type: 'absence',
                    description: `${absentDays} day(s) absent`,
                    amount: absenceDeduction
                });
                totalDeductions += absenceDeduction;
            }

            const totalLateMinutes = attendances.reduce((s, a) => s + (a.workingHours?.lateMinutes || 0), 0);
            if (totalLateMinutes > 60) {
                const lateHours = Math.floor(totalLateMinutes / 60);
                const lateDeduction = Math.round(lateHours * hourlyRate);
                deductions.push({
                    type: 'late',
                    description: `${totalLateMinutes} minutes late`,
                    amount: lateDeduction
                });
                totalDeductions += lateDeduction;
            }

            // Warnings for missing days
            const warnings = [];
            const totalWorkingDaysInPeriod = getWorkingDaysInMonth(year, month, company.settings.workingDays);
            if (totalDays < totalWorkingDaysInPeriod) {
                warnings.push(`${totalWorkingDaysInPeriod - totalDays} working day(s) had no attendance record — treated as absent`);
            }

            const salary = new Salary({
                company: req.user.company,
                branch: employee.branch,
                employee: employee._id,
                month: parseInt(month),
                year: parseInt(year),
                baseSalary: employee.baseSalary,
                attendanceSummary: {
                    totalDays, presentDays, absentDays, lateDays, halfDays, leaveDays, overtimeHours
                },
                earnings: {
                    basePay,
                    overtimePay,
                    bonus: 0,
                    allowances: 0,
                    commission: 0
                },
                deductions,
                advances: [],
                warnings,
                generatedBy: req.user._id
            });

            await salary.save();
            generated.push(salary);
        } catch (empErr) {
            errors.push({ employee: employee.fullName, error: empErr.message });
        }
    }

    await auditHelper.log(req, {
        action: 'SALARY_GENERATE',
        entityType: 'Salary',
        entityName: `Payroll ${period}`,
        changes: { after: { period, count: generated.length } }
    });

    return {
        generated: generated.length,
        errors: errors.length > 0 ? errors : undefined,
        salaries: generated.map(s => s.toPublicJSON('employer'))
    };
}

// ============================================================
// List salaries
// ============================================================
async function listSalaries(req) {
    const { month, year, status, branchId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company };

    if (req.user.role === 'employer') {
        if (branchId) query.branch = branchId;
        else if (req.branch) query.branch = req.branch;
    } else if (req.user.activeRoles?.includes('manager')) {
        query.branch = req.user.branch;
    } else {
        // Employee sees own
        query.employee = req.user._id;
    }

    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (status) query['payment.status'] = status;

    const salaries = await Salary.find(query)
        .populate('employee', 'firstName lastName employeeId baseSalary')
        .populate('branch', 'name code')
        .sort({ year: -1, month: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Salary.countDocuments(query);

    const viewerRole = req.user.role === 'employer'
        ? 'employer'
        : (req.user.activeRoles?.includes('manager') ? 'manager' : 'employee');

    return {
        salaries: salaries.map(s => s.toPublicJSON(viewerRole)),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

// ============================================================
// Pay salary
// ============================================================
async function paySalary(req, id, data) {
    const { paymentMethod, transactionReference, bankAccount, bankName } = data;

    const salary = await Salary.findOne({ _id: id, company: req.user.company });
    if (!salary) throw { status: 404, message: 'Salary record not found' };

    // Scope
    if (req.user.role !== 'employer') {
        if (!req.user.activeRoles?.includes('manager') && !req.user.activeRoles?.includes('accounting')) {
            throw { status: 403, message: 'Only employer, manager, or accounting can pay' };
        }
        if (salary.branch.toString() !== req.user.branch.toString()) {
            throw { status: 403, message: 'Not authorized for this branch' };
        }
    }

    salary.markPaid(req.user, {
        paymentMethod: paymentMethod || 'bank_transfer',
        transactionReference,
        bankAccount,
        bankName
    });
    await salary.save();

    await auditHelper.log(req, {
        action: 'SALARY_PAY',
        entityType: 'Salary',
        entityId: salary._id,
        entityName: `Salary ${salary.period}`
    });

    return salary.toPublicJSON('employer');
}

// ============================================================
// Add bonus (manager → requires employer approval)
// ============================================================
async function addBonus(req, id, data) {
    const { amount, reason } = data;
    if (!amount || amount <= 0) throw { status: 400, message: 'Valid amount required' };

    const salary = await Salary.findOne({ _id: id, company: req.user.company });
    if (!salary) throw { status: 404, message: 'Salary not found' };

    if (salary.payment.status === 'paid') {
        throw { status: 400, message: 'Cannot modify a paid salary' };
    }

    const isManager = req.user.activeRoles?.includes('manager') && req.user.role !== 'employer';
    const isEmployer = req.user.role === 'employer';

    if (!isEmployer && !isManager) {
        throw { status: 403, message: 'Only manager or employer can add bonuses' };
    }

    if (isManager && salary.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'You can only add bonuses to your branch' };
    }

    salary.earnings.bonus = (salary.earnings.bonus || 0) + parseFloat(amount);
    salary.bonusApproval = {
        addedBy: req.user._id,
        addedByName: `${req.user.firstName} ${req.user.lastName}`,
        addedAt: new Date(),
        status: isManager ? 'pending' : 'approved',
        ...(isEmployer && { approvedBy: req.user._id, approvedByName: `${req.user.firstName} ${req.user.lastName}`, approvedAt: new Date() })
    };

    await salary.save();

    await auditHelper.log(req, {
        action: 'BONUS_ADD',
        entityType: 'Salary',
        entityId: salary._id,
        entityName: `Bonus ${salary.period}`,
        changes: { after: { amount, status: salary.bonusApproval.status } }
    });

    return salary.toPublicJSON(req.user.role === 'employer' ? 'employer' : 'manager');
}

// ============================================================
// Approve bonus (employer only)
// ============================================================
async function approveBonus(req, id, approved) {
    if (req.user.role !== 'employer') {
        throw { status: 403, message: 'Only employer can approve bonuses' };
    }

    const salary = await Salary.findOne({ _id: id, company: req.user.company });
    if (!salary) throw { status: 404, message: 'Salary not found' };

    if (salary.bonusApproval.status !== 'pending') {
        throw { status: 400, message: 'No pending bonus approval' };
    }

    if (approved) {
        salary.bonusApproval.status = 'approved';
        salary.bonusApproval.approvedBy = req.user._id;
        salary.bonusApproval.approvedByName = `${req.user.firstName} ${req.user.lastName}`;
        salary.bonusApproval.approvedAt = new Date();
    } else {
        // Remove bonus
        salary.earnings.bonus = 0;
        salary.bonusApproval.status = 'rejected';
    }

    await salary.save();

    await auditHelper.log(req, {
        action: approved ? 'BONUS_APPROVE' : 'BONUS_REJECT',
        entityType: 'Salary',
        entityId: salary._id,
        entityName: `Bonus ${salary.period}`
    });

    return salary.toPublicJSON('employer');
}

// ============================================================
// Request advance (employee)
// ============================================================
async function requestAdvance(req, data) {
    const { amount, reason } = data;
    if (!amount || amount <= 0) throw { status: 400, message: 'Valid amount required' };

    const employee = await User.findById(req.user._id);
    const company = await Company.findById(req.user.company);

    const percentCap = (company.settings?.advanceBaseSalaryPercent || 50) / 100;
    const maxAmount = employee.baseSalary * percentCap;

    if (amount > maxAmount) {
        throw { status: 400, message: `Advance cannot exceed ${maxAmount} (${percentCap * 100}% of base salary)` };
    }

    // Add to user's pending advances for this period
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (!employee.salaryRecords) employee.salaryRecords = [];

    let record = employee.salaryRecords.find(r => r.period === period);
    if (!record) {
        record = {
            period,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            baseSalary: employee.baseSalary,
            advances: []
        };
        employee.salaryRecords.push(record);
    }

    if (!record.advances) record.advances = [];
    record.advances.push({
        amount: parseFloat(amount),
        reason: reason || 'Advance',
        date: new Date(),
        status: 'pending'
    });

    await employee.save();

    await auditHelper.log(req, {
        action: 'ADVANCE_REQUEST',
        entityType: 'User',
        entityId: employee._id,
        entityName: `${employee.firstName} ${employee.lastName}`,
        changes: { after: { amount, period } }
    });

    return { message: 'Advance request submitted', amount, period };
}

// ============================================================
// Approve advance (manager/employer with limits)
// ============================================================
async function approveAdvance(req, salaryId, data) {
    const { advanceIndex, status } = data;

    const salary = await Salary.findOne({ _id: salaryId, company: req.user.company });
    if (!salary) throw { status: 404, message: 'Salary not found' };

    if (!salary.advances[advanceIndex]) {
        throw { status: 404, message: 'Advance not found at that index' };
    }

    // Manager limit
    if (req.user.role !== 'employer') {
        if (!req.user.activeRoles?.includes('manager')) {
            throw { status: 403, message: 'Only manager or employer can approve advances' };
        }
        if (salary.branch.toString() !== req.user.branch.toString()) {
            throw { status: 403, message: 'Not authorized for this branch' };
        }
        const company = await Company.findById(req.user.company);
        const limit = company.settings?.advanceManagerLimit || 50000;
        if (salary.advances[advanceIndex].amount > limit) {
            throw { status: 403, message: `Advance exceeds manager limit of ₦${limit}. Requires employer approval.` };
        }
    }

    salary.advances[advanceIndex].status = status;
    salary.advances[advanceIndex].approvedBy = req.user._id;
    await salary.save();

    await auditHelper.log(req, {
        action: status === 'approved' ? 'ADVANCE_APPROVE' : 'ADVANCE_REJECT',
        entityType: 'Salary',
        entityId: salary._id,
        entityName: `Advance ${salary.period}`
    });

    return salary.toPublicJSON('employer');
}

// ============================================================
// Submit dispute (employee)
// ============================================================
async function submitDispute(req, id, data) {
    const { issue } = data;
    if (!issue) throw { status: 400, message: 'Issue description required' };

    const salary = await Salary.findOne({ _id: id, employee: req.user._id, company: req.user.company });
    if (!salary) throw { status: 404, message: 'Salary not found' };

    try {
        salary.submitDispute(issue);
    } catch (err) {
        throw { status: 400, message: err.message };
    }

    await salary.save();

    await auditHelper.log(req, {
        action: 'SALARY_DISPUTE',
        entityType: 'Salary',
        entityId: salary._id,
        entityName: `Dispute ${salary.period}`,
        severity: 'warning'
    });

    return salary.toPublicJSON('employee');
}

// ============================================================
// Resolve dispute (manager/employer)
// ============================================================
async function resolveDispute(req, salaryId, disputeIndex, data) {
    const { resolution, status = 'resolved' } = data;

    const salary = await Salary.findOne({ _id: salaryId, company: req.user.company });
    if (!salary) throw { status: 404, message: 'Salary not found' };

    if (req.user.role !== 'employer' && salary.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'Not authorized' };
    }

    if (!salary.employeeConfirmation.disputes[disputeIndex]) {
        throw { status: 404, message: 'Dispute not found' };
    }

    salary.employeeConfirmation.disputes[disputeIndex].status = status;
    salary.employeeConfirmation.disputes[disputeIndex].resolvedBy = req.user._id;
    salary.employeeConfirmation.disputes[disputeIndex].resolvedByName = `${req.user.firstName} ${req.user.lastName}`;
    salary.employeeConfirmation.disputes[disputeIndex].resolution = resolution;
    salary.employeeConfirmation.disputes[disputeIndex].resolvedAt = new Date();

    if (status === 'resolved') {
        salary.payment.status = 'pending';
    }

    await salary.save();

    await auditHelper.log(req, {
        action: 'SALARY_RESOLVE',
        entityType: 'Salary',
        entityId: salary._id,
        entityName: `Dispute resolution ${salary.period}`
    });

    return salary.toPublicJSON('employer');
}

module.exports = {
    generateSalaries, listSalaries, paySalary,
    addBonus, approveBonus,
    requestAdvance, approveAdvance,
    submitDispute, resolveDispute
};