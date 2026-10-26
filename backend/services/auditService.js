/**
 * Audit Service
 * Query, filter, export audit logs. Read-only.
 */
const AuditLog = require('../models/AuditLog');

// ============================================================
// List audit logs (employer only)
// ============================================================
async function listLogs(req) {
    const {
        action, entityType, entityId, performedBy, severity,
        branchId, startDate, endDate,
        page = 1, limit = 50
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { company: req.user.company };

    if (req.user.role === 'employer') {
        if (branchId) query.branch = branchId;
    } else {
        query.branch = req.user.branch;
    }

    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    if (performedBy) query.performedBy = performedBy;
    if (severity) query.severity = severity;
    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
        .populate('performedBy', 'firstName lastName role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    return {
        logs: logs.map(l => l.toPublicJSON()),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

// ============================================================
// Get single log
// ============================================================
async function getLog(req, id) {
    const log = await AuditLog.findOne({ _id: id, company: req.user.company })
        .populate('performedBy', 'firstName lastName role');

    if (!log) throw { status: 404, message: 'Audit log not found' };
    return log.toPublicJSON();
}

// ============================================================
// Summary (last N days)
// ============================================================
async function getSummary(req) {
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const query = { company: req.user.company, timestamp: { $gte: since } };
    if (req.user.role !== 'employer') query.branch = req.user.branch;
    else if (req.branch) query.branch = req.branch;

    const summary = await AuditLog.aggregate([
        { $match: query },
        {
            $group: {
                _id: null,
                totalActions: { $sum: 1 },
                successfulActions: { $sum: { $cond: [{ $eq: ['$result.success', true] }, 1, 0] } },
                failedActions: { $sum: { $cond: [{ $eq: ['$result.success', false] }, 1, 0] } },
                criticalActions: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } }
            }
        }
    ]);

    const actionsByType = await AuditLog.aggregate([
        { $match: query },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);

    const actionsByUser = await AuditLog.aggregate([
        { $match: { ...query, performedBy: { $ne: null } } },
        { $group: { _id: '$performedBy', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);

    return {
        summary: summary[0] || { totalActions: 0, successfulActions: 0, failedActions: 0, criticalActions: 0 },
        actionsByType,
        actionsByUser
    };
}

// ============================================================
// Export logs (employer only, rate-limited at route level)
// ============================================================
async function exportLogs(req) {
    const { startDate, endDate, action, entityType } = req.query;

    const query = { company: req.user.company };
    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;

    // Cap at 10,000 for memory safety
    const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(10000);

    return logs.map(l => ({
        timestamp: l.timestamp.toISOString(),
        action: l.action,
        entityType: l.entityType,
        entityName: l.entityName || '',
        performedByName: l.performedByName,
        performedByRole: l.performedByRole,
        severity: l.severity,
        success: l.result?.success ?? true,
        errorMessage: l.result?.errorMessage || ''
    }));
}

// ============================================================
// User-specific logs
// ============================================================
async function getUserLogs(req, userId) {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company, performedBy: userId };
    if (req.user.role !== 'employer') query.branch = req.user.branch;

    const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    return {
        logs: logs.map(l => l.toPublicJSON()),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

module.exports = { listLogs, getLog, getSummary, exportLogs, getUserLogs };