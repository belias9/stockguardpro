const Company = require('../models/company');
const Branch = require('../models/Branch');
const EndOfDayReport = require('../models/EndOfDayReport');
const Inventory = require('../models/Inventory');
const Receipt = require('../models/Receipt');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const PreRecord = require('../models/PreRecord');
const Withdrawal = require('../models/Withdrawal');
const CashierSession = require('../models/CashierSession');

function localDateParts(date, timezone) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    return Object.fromEntries(parts.map(p => [p.type, p.value]));
}
function localClock(date, timezone) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${values.hour}:${values.minute}`;
}
function localMidnightUtc(dateText, timezone) {
    const [year, month, day] = dateText.split('-').map(Number);
    const target = Date.UTC(year, month - 1, day, 0, 0, 0);
    let guess = target;
    for (let i = 0; i < 3; i++) {
        const p = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
        const v = Object.fromEntries(p.map(x => [x.type, Number(x.value)]));
        guess = target - (Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - guess);
    }
    return new Date(guess);
}

async function generateBranchReport(company, branch, dateText, start, end) {
    const reportDate = dateText;
    const reportDateStored = new Date(`${dateText}T12:00:00.000Z`);
    const existing = await EndOfDayReport.findOne({ company: company._id, branch: branch._id, reportDate });
    if (existing) return existing;

    const base = { company: company._id, branch: branch._id };
    const [pres, inv, receipts, attendees, employees, withdrawals, incomingWithdrawals, sessions] = await Promise.all([
        PreRecord.find({ ...base, purchaseDate: { $gte: start, $lt: end } }).select('preRecordId buyerName totalItems totalCost status'),
        Inventory.find({ ...base, isActive: true }).select('name itemCode quantity reorderPoint location'),
        Receipt.find({ ...base, createdAt: { $gte: start, $lt: end }, status: { $nin: ['cancelled', 'refunded'] } }).select('receiptId customer.name totalAmount totalCost totalProfit paymentStatus soldByName createdAt'),
        Attendance.find({ ...base, date: { $gte: start, $lt: end } }).select('status employee'),
        User.countDocuments({ ...base, role: 'employee', isActive: true, accountClosed: false }),
        Withdrawal.find({ company: company._id, sourceBranch: branch._id }).select('status totalCost createdAt updatedAt'),
        Withdrawal.find({ company: company._id, destinationBranch: branch._id, createdAt: { $gte: start, $lt: end } }).select('status updatedAt'),
        CashierSession.find({ ...base, date: { $gte: start, $lt: end } }).select('cashierName transactions totals')
    ]);
    const confirmedReceipts = receipts.filter(r => r.paymentStatus === 'confirmed');
    const low = inv.filter(i => i.quantity <= i.reorderPoint);
    const out = inv.filter(i => i.quantity <= 0);
    const attendanceCounts = { present: 0, late: 0, absent: 0, onLeave: 0 };
    for (const a of attendees) {
        if (a.status === 'present') attendanceCounts.present++;
        else if (a.status === 'late') attendanceCounts.late++;
        else if (a.status === 'absent') attendanceCounts.absent++;
        else if (a.status === 'on_leave') attendanceCounts.onLeave++;
    }
    const bought = { totalPreRecords: pres.length, confirmed: pres.filter(p=>p.status==='confirmed').length, pending: pres.filter(p=>p.status==='pending').length, rejected: pres.filter(p=>p.status==='rejected').length, totalCost: pres.filter(p=>p.status==='confirmed').reduce((n,p)=>n+(p.totalCost||0),0), items: pres.map(p=>({ preRecordId:p.preRecordId, buyerName:p.buyerName, itemCount:p.totalItems, totalCost:p.totalCost, status:p.status })) };
    const totalReceived = confirmedReceipts.reduce((n,r)=>n+(r.totalAmount||0),0);
    const totalCost = confirmedReceipts.reduce((n,r)=>n+(r.totalCost||0),0);
    const totalProfit = confirmedReceipts.reduce((n,r)=>n+(r.totalProfit||0),0);
    const report = new EndOfDayReport({
        ...base, date: reportDateStored, reportDate,
        goodsBought: bought,
        attendance: { totalEmployees: employees, present: attendanceCounts.present, late: attendanceCounts.late, absent: attendanceCounts.absent, onLeave: attendanceCounts.onLeave, notClocked: Math.max(0, employees - attendees.length), attendanceRate: employees ? Math.round(((attendanceCounts.present + attendanceCounts.late) / employees) * 1000) / 10 : 0 },
        cashier: { totalSessions: sessions.length, totalTransactions: confirmedReceipts.length, totalReceived, totalCost, totalProfit, profitMargin: totalReceived ? Math.round(totalProfit / totalReceived * 10000) / 100 : 0, totalDisputed: receipts.filter(r=>r.paymentStatus==='disputed').length, totalPending: receipts.filter(r=>r.paymentStatus==='pending').length, perCashier: sessions.map(s=>({ cashierName:s.cashierName, transactions:s.totals.transactionCount, totalReceived:s.totals.totalReceived, totalProfit:s.totals.totalProfit, disputed:s.totals.disputedCount })) },
        transfers: { pending: withdrawals.filter(w=>w.status==='pending'||w.status==='approved').length, inTransit: withdrawals.filter(w=>w.status==='in_transit').length, completedToday: [...withdrawals.filter(w=>w.status==='completed'&&w.updatedAt>=start&&w.updatedAt<end), ...incomingWithdrawals.filter(w=>w.status==='completed')].length, totalValue: withdrawals.filter(w=>w.createdAt>=start&&w.createdAt<end).reduce((n,w)=>n+(w.totalCost||0),0) },
        inventoryAlerts: { lowStockCount: low.length, outOfStockCount: out.length, lowStockItems: low.slice(0,100).map(i=>({ itemCode:i.itemCode, itemName:i.name, quantity:i.quantity, reorderPoint:i.reorderPoint, warehouse:i.location?.warehouse || '' })) }
    });
    report.markSent('in_app');
    try { await report.save(); }
    catch (err) { if (err.code === 11000) return EndOfDayReport.findOne({ company: company._id, branch: branch._id, reportDate }); throw err; }
    try { require('../config/socket').emitToCompany(company._id, 'end-of-day-report-ready', { reportId: report._id, branchId: branch._id, reportDate }); } catch {}
    return report;
}

async function generateCompanyReports(company, date = new Date()) {
    const timezone = company.settings?.timezone || 'UTC';
    const parts = localDateParts(date, timezone);
    const dateText = `${parts.year}-${parts.month}-${parts.day}`;
    const start = localMidnightUtc(dateText, timezone);
    const end = new Date(start.getTime() + 86400000);
    const branches = await Branch.find({ company: company._id, isActive: true }).select('_id name');
    const reports = [];
    for (const branch of branches) reports.push(await generateBranchReport(company, branch, dateText, start, end));
    return reports;
}

async function generateDueReports(now = new Date()) {
    const companies = await Company.find({ isActive: true }).select('settings.timezone settings.endOfDayReportTime');
    let generated = 0;
    for (const company of companies) {
        try {
            const timezone = company.settings?.timezone || 'UTC';
            const current = localClock(now, timezone);
            const due = company.settings?.endOfDayReportTime || '22:00';
            if (current < due) continue;
            const dateParts = localDateParts(now, timezone);
            const dateText = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
            const branchCount = await Branch.countDocuments({ company: company._id, isActive: true });
            const reportCount = await EndOfDayReport.countDocuments({ company: company._id, reportDate: dateText });
            if (!branchCount || reportCount >= branchCount) continue;
            generated += (await generateCompanyReports(company, now)).length;
        } catch (err) { require('../utils/logger').error('[EOD] Report generation failed:', { company: company._id, error: err.message }); }
    }
    return { generated };
}

async function listReports(req, query = {}) {
    const filter = { company: req.user.company };
    if (req.user.role !== 'employer') filter.branch = req.user.branch;
    else if (req.branch) filter.branch = req.branch;
    if (query.date) filter.reportDate = String(query.date).slice(0, 10);
    return EndOfDayReport.find(filter).populate('branch', 'name code').sort({ date: -1 }).limit(Math.min(Number(query.limit) || 30, 100));
}

module.exports = { generateDueReports, generateCompanyReports, listReports };
