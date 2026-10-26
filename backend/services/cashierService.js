/**
 * Cashier Service
 * Daily session management + money confirmation.
 * Profit is stripped server-side for cashier role.
 */
const CashierSession = require('../models/CashierSession');
const Receipt = require('../models/Receipt');
const auditHelper = require('../utils/auditHelper');

// ============================================================
// Get or create today's session for cashier
// ============================================================
async function getOrCreateSession(req) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let session = await CashierSession.findOne({
        cashier: req.user._id,
        date: today
    });

    if (!session) {
        session = await CashierSession.create({
            company: req.user.company,
            branch: req.user.branch,
            cashier: req.user._id,
            cashierName: `${req.user.firstName} ${req.user.lastName}`,
            date: today
        });
    }

    return session;
}

// ============================================================
// Get current session
// ============================================================
async function getCurrentSession(req) {
    const session = await getOrCreateSession(req);
    return session.toPublicJSON('cashier');
}

// ============================================================
// Get pending receipts (awaiting payment confirmation)
// ============================================================
async function getPendingReceipts(req) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const receipts = await Receipt.find({
        company: req.user.company,
        branch: req.user.branch,
        paymentStatus: 'pending',
        status: { $in: ['draft', 'finalized'] },
        createdAt: { $gte: today }
    })
        .populate('soldBy', 'firstName lastName')
        .sort({ createdAt: 1 });

    // Strip profit from cashier view
    return receipts.map(r => r.toPublicJSON('cashier'));
}

// ============================================================
// Confirm payment (adds to session)
// ============================================================
async function confirmPayment(req, receiptId, notes) {
    const receipt = await Receipt.findOne({
        _id: receiptId,
        company: req.user.company,
        branch: req.user.branch
    });

    if (!receipt) throw { status: 404, message: 'Receipt not found' };
    if (receipt.paymentStatus === 'confirmed') {
        throw { status: 400, message: 'Payment already confirmed' };
    }

    // Confirm the receipt
    receipt.confirmPayment(req.user, notes || '');
    await receipt.save();

    // Add to cashier session
    const session = await getOrCreateSession(req);
    session.addTransaction({
        receipt: receipt._id,
        receiptId: receipt.receiptId,
        amount: receipt.totalAmount,
        cost: receipt.totalCost,
        paymentMethod: receipt.paymentMethod
    });
    await session.save();

    await auditHelper.log(req, {
        action: 'PAYMENT_CONFIRM',
        entityType: 'Receipt',
        entityId: receipt._id,
        entityName: receipt.receiptId
    });

    return {
        receipt: receipt.toPublicJSON('cashier'),
        session: session.toPublicJSON('cashier')
    };
}

// ============================================================
// Dispute payment
// ============================================================
async function disputePayment(req, receiptId, reason) {
    if (!reason) throw { status: 400, message: 'Dispute reason required' };

    const receipt = await Receipt.findOne({
        _id: receiptId,
        company: req.user.company,
        branch: req.user.branch
    });

    if (!receipt) throw { status: 404, message: 'Receipt not found' };
    if (receipt.paymentStatus === 'confirmed') {
        throw { status: 400, message: 'Cannot dispute a confirmed payment' };
    }

    receipt.disputePayment(req.user, reason);
    await receipt.save();

    await auditHelper.log(req, {
        action: 'PAYMENT_DISPUTE',
        entityType: 'Receipt',
        entityId: receipt._id,
        entityName: receipt.receiptId,
        severity: 'warning'
    });

    return receipt.toPublicJSON('cashier');
}

// ============================================================
// Get daily report (session summary)
// ============================================================
async function getDailyReport(req, date) {
    const reportDate = date ? new Date(date) : new Date();
    reportDate.setHours(0, 0, 0, 0);

    const session = await CashierSession.findOne({
        cashier: req.user._id,
        date: reportDate
    });

    if (!session) {
        throw { status: 404, message: 'No session found for this date' };
    }

    // Cashier sees own session without profit
    return session.toPublicJSON('cashier');
}

// ============================================================
// Close session (end of day)
// ============================================================
async function closeSession(req, notes) {
    const session = await getOrCreateSession(req);
    session.close(notes || 'End of day');
    await session.save();

    await auditHelper.log(req, {
        action: 'UPDATE',
        entityType: 'CashierSession',
        entityId: session._id,
        entityName: `Session ${session.date.toISOString().slice(0, 10)}`
    });

    return session.toPublicJSON('cashier');
}

// ============================================================
// List all sessions (employer/manager only — includes profit)
// ============================================================
async function listSessions(req) {
    const { date, cashierId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company };

    if (req.user.role !== 'employer') query.branch = req.user.branch;
    else if (req.branch) query.branch = req.branch;

    if (date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        query.date = d;
    }
    if (cashierId) query.cashier = cashierId;

    const sessions = await CashierSession.find(query)
        .populate('cashier', 'firstName lastName')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await CashierSession.countDocuments(query);

    // Employer/manager sees profit
    const viewerRole = req.user.role === 'employer' || req.user.activeRoles?.includes('manager')
        ? 'employer'
        : 'cashier';

    return {
        sessions: sessions.map(s => s.toPublicJSON(viewerRole)),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

module.exports = {
    getOrCreateSession,
    getCurrentSession,
    getPendingReceipts,
    confirmPayment,
    disputePayment,
    getDailyReport,
    closeSession,
    listSessions
};