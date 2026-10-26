/**
 * Dashboard + Reports Service
 * Role-aware analytics. Profit hidden by role.
 */
const Inventory = require('../models/Inventory');
const Withdrawal = require('../models/Withdrawal');
const Attendance = require('../models/Attendance');
const Salary = require('../models/Salary');
const User = require('../models/User');
const Communication = require('../models/Communication');
const Receipt = require('../models/Receipt');

// ============================================================
// Employer/Manager dashboard overview
// ============================================================
async function getOverview(req) {
    const companyId = req.user.company;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Branch scope
    const branchScope = req.user.role === 'employer'
        ? (req.branch || null)
        : req.user.branch;

    const branchQuery = branchScope ? { branch: branchScope } : {};

    // Inventory
    const totalInventory = await Inventory.countDocuments({ company: companyId, isActive: true, ...branchQuery });
    const lowStockItems = await Inventory.countDocuments({
        company: companyId, isActive: true, ...branchQuery,
        $expr: { $lte: ['$quantity', '$reorderPoint'] }
    });

    const inventoryValue = await Inventory.aggregate([
        { $match: { company: companyId, isActive: true, ...branchQuery } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', '$unitCost'] } } } }
    ]);

    // Withdrawals
    const pendingWithdrawals = await Withdrawal.countDocuments({
        company: companyId, ...branchQuery,
        status: { $in: ['pending', 'approved'] }
    });

    const todayWithdrawals = await Withdrawal.countDocuments({
        company: companyId, ...branchQuery,
        createdAt: { $gte: today, $lt: tomorrow }
    });

    // Attendance
    const presentToday = await Attendance.countDocuments({
        company: companyId, ...branchQuery,
        date: { $gte: today, $lt: tomorrow },
        status: { $in: ['present', 'late'] }
    });

    const absentToday = await Attendance.countDocuments({
        company: companyId, ...branchQuery,
        date: { $gte: today, $lt: tomorrow },
        status: 'absent'
    });

    const totalEmployees = await User.countDocuments({
        company: companyId, ...branchQuery,
        role: 'employee', isActive: true, accountClosed: false
    });

    // Communication
    const unreadMessages = await Communication.countDocuments({
        company: companyId,
        recipient: req.user._id,
        status: 'unread'
    });

    const pendingComplaints = await Communication.countDocuments({
        company: companyId,
        type: 'complaint',
        status: { $in: ['unread', 'in_progress'] }
    });

    // Salary
    const pendingSalaries = await Salary.countDocuments({
        company: companyId, ...branchQuery,
        'payment.status': 'pending'
    });

    const disputedSalaries = await Salary.countDocuments({
        company: companyId, ...branchQuery,
        'payment.status': 'disputed'
    });

    return {
        inventory: {
            totalItems: totalInventory,
            lowStock: lowStockItems,
            totalValue: inventoryValue[0]?.total || 0
        },
        withdrawals: {
            pending: pendingWithdrawals,
            today: todayWithdrawals
        },
        attendance: {
            presentToday,
            absentToday,
            totalEmployees,
            attendanceRate: totalEmployees > 0 ? ((presentToday / totalEmployees) * 100).toFixed(1) : 0
        },
        communication: { unreadMessages, pendingComplaints },
        salary: { pendingPayments: pendingSalaries, disputed: disputedSalaries }
    };
}

// ============================================================
// Employee dashboard
// ============================================================
async function getEmployeeDashboard(req) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayAttendance = await Attendance.findOne({
        employee: req.user._id,
        date: { $gte: today, $lt: tomorrow }
    });

    const monthAttendance = await Attendance.find({
        employee: req.user._id,
        date: { $gte: startOfMonth }
    });

    const attendanceSummary = {
        present: monthAttendance.filter(a => a.status === 'present').length,
        absent: monthAttendance.filter(a => a.status === 'absent').length,
        late: monthAttendance.filter(a => a.status === 'late').length,
        onLeave: monthAttendance.filter(a => a.status === 'on_leave').length,
        totalHours: monthAttendance.reduce((s, a) => s + (a.workingHours?.totalHours || 0), 0)
    };

    const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const currentSalary = await Salary.findOne({ employee: req.user._id, period });

    const unreadMessages = await Communication.countDocuments({
        recipient: req.user._id,
        company: req.user.company,
        status: 'unread'
    });

    // Pending advances from user's salaryRecords
    const fullUser = await User.findById(req.user._id);
    const pendingAdvances = (fullUser.salaryRecords || []).reduce((count, sr) => {
        return count + (sr.advances || []).filter(a => a.status === 'pending').length;
    }, 0);

    return {
        todayAttendance: todayAttendance || { status: 'not_clocked' },
        attendanceSummary,
        currentSalary: currentSalary ? currentSalary.toPublicJSON('employee') : null,
        unreadMessages,
        pendingAdvances,
        baseSalary: fullUser.baseSalary
    };
}

// ============================================================
// Structure value report
// ============================================================
async function getStructureValueReport(req, query) {
    const { branchId, warehouseId, startDate, endDate } = query;

    // Only employer and manager
    if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('manager')) {
        throw { status: 403, message: 'Not authorized' };
    }

    const match = { company: req.user.company, isActive: true };

    if (req.user.role === 'employer') {
        if (branchId) match.branch = branchId;
        if (warehouseId) match.warehouse = warehouseId;
    } else {
        match.branch = req.user.branch;
    }

    const items = await Inventory.find(match);

    const byWarehouse = {};
    items.forEach(i => {
        const wid = i.warehouse.toString();
        if (!byWarehouse[wid]) {
            byWarehouse[wid] = {
                warehouse: wid,
                itemCount: 0,
                stockValue: 0,
                sellingValue: 0,
                potentialProfit: 0
            };
        }
        byWarehouse[wid].itemCount += 1;
        byWarehouse[wid].stockValue += i.quantity * i.unitCost;
        byWarehouse[wid].sellingValue += i.quantity * i.sellingPrice;
        byWarehouse[wid].potentialProfit += i.quantity * (i.sellingPrice - i.unitCost);
    });

    // Actual sales in period
    const receiptMatch = { company: req.user.company, status: 'finalized' };
    if (startDate || endDate) {
        receiptMatch.createdAt = {};
        if (startDate) receiptMatch.createdAt.$gte = new Date(startDate);
        if (endDate) receiptMatch.createdAt.$lte = new Date(endDate);
    }
    if (req.user.role !== 'employer') receiptMatch.branch = req.user.branch;
    else if (branchId) receiptMatch.branch = branchId;

    const salesAgg = await Receipt.aggregate([
        { $match: receiptMatch },
        {
            $group: {
                _id: null,
                totalSold: { $sum: '$totalAmount' },
                totalCost: { $sum: '$totalCost' },
                transactionCount: { $sum: 1 }
            }
        }
    ]);

    const sales = salesAgg[0] || { totalSold: 0, totalCost: 0, transactionCount: 0 };
    const profit = sales.totalSold - sales.totalCost;

    return {
        structures: Object.values(byWarehouse),
        sales: {
            totalSold: sales.totalSold,
            totalCost: sales.totalCost,
            profit,
            profitMargin: sales.totalSold > 0 ? (profit / sales.totalSold) * 100 : 0,
            transactionCount: sales.transactionCount
        }
    };
}

// ============================================================
// Company value report (employer only)
// ============================================================
async function getCompanyValueReport(req) {
    if (req.user.role !== 'employer') {
        throw { status: 403, message: 'Employer only' };
    }

    const inventoryValue = await Inventory.aggregate([
        { $match: { company: req.user.company, isActive: true } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', '$unitCost'] } } } }
    ]);

    const sellingValue = await Inventory.aggregate([
        { $match: { company: req.user.company, isActive: true } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } } } }
    ]);

    return {
        inventory: {
            costValue: inventoryValue[0]?.total || 0,
            sellingValue: sellingValue[0]?.total || 0,
            potentialProfit: (sellingValue[0]?.total || 0) - (inventoryValue[0]?.total || 0)
        }
    };
}

module.exports = { getOverview, getEmployeeDashboard, getStructureValueReport, getCompanyValueReport };