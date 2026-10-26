/**
 * Audit Helper
 * Central function for logging all actions.
 * Append-only. Never throws — audit failures must not break the request.
 */
const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

/**
 * log() — write an audit entry
 * @param {Object} req — express request (for user/ip/userAgent)
 * @param {Object} options — { action, entityType, entityId, entityName, changes, result, severity }
 */
async function log(req, options) {
    try {
        const entry = {
            action: options.action,
            entityType: options.entityType,
            entityId: options.entityId || null,
            entityName: options.entityName || null,
            performedBy: req.user?._id || null,
            performedByName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : 'System',
            performedByRole: req.user?.role || 'system',
            company: req.user?.company || options.company || req.body?.companyId || null,
            branch: req.branch || req.user?.branch || null,
            changes: options.changes || undefined,
            requestDetails: {
                ipAddress: req.ip,
                userAgent: req.headers?.['user-agent'],
                method: req.method,
                path: req.originalUrl
            },
            result: {
                success: options.result?.success ?? true,
                statusCode: options.result?.statusCode,
                errorMessage: options.result?.errorMessage
            },
            severity: options.severity || 'info'
        };

        await AuditLog.create(entry);
    } catch (err) {
        // Never throw from audit — just log the failure
        logger.error('[Audit] Failed to write audit log:', {
            error: err.message,
            action: options.action,
            entityType: options.entityType
        });
    }
}

/**
 * Convenience wrappers for common patterns
 */
const logCreate = (req, entityType, entityId, entityName, extra = {}) =>
    log(req, { action: 'CREATE', entityType, entityId, entityName, ...extra });

const logUpdate = (req, entityType, entityId, entityName, before, after, extra = {}) =>
    log(req, {
        action: 'UPDATE',
        entityType,
        entityId,
        entityName,
        changes: { before, after },
        ...extra
    });

const logDelete = (req, entityType, entityId, entityName, extra = {}) =>
    log(req, { action: 'DELETE', entityType, entityId, entityName, severity: 'warning', ...extra });

const logAction = (req, action, entityType, entityId, entityName, extra = {}) =>
    log(req, { action, entityType, entityId, entityName, ...extra });

const logAuth = (req, action, user = null, extra = {}) =>
    log(req, {
        action,
        entityType: 'User',
        entityId: user?._id,
        entityName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
        ...extra
    });

module.exports = {
    log,
    logCreate,
    logUpdate,
    logDelete,
    logAction,
    logAuth
};