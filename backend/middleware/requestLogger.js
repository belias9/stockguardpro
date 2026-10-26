/**
 * Request Logger
 * Structured logging for every request. No PII, no tokens, no bodies.
 */
const logger = require('../utils/logger');

const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'secret', 'apiKey', 'fingerprint'];

const sanitizeBody = (body) => {
    if (!body || typeof body !== 'object') return body;
    const clean = {};
    for (const key of Object.keys(body)) {
        if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
            clean[key] = '[REDACTED]';
        } else if (typeof body[key] === 'object') {
            clean[key] = sanitizeBody(body[key]);
        } else {
            clean[key] = body[key];
        }
    }
    return clean;
};

const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Capture response finish
    res.on('finish', () => {
        const duration = Date.now() - start;
        const log = {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userId: req.user?._id?.toString(),
            role: req.user?.role,
            branch: req.branch || req.user?.branch?.toString()
        };

        // Log level based on status
        if (res.statusCode >= 500) {
            logger.error('[Request]', log);
        } else if (res.statusCode >= 400) {
            logger.warn('[Request]', log);
        } else {
            logger.info('[Request]', log);
        }

        // Log redacted body for POST/PUT/PATCH (dev only)
        if (process.env.NODE_ENV === 'development' && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
            logger.debug('[Request Body]', {
                path: req.originalUrl,
                body: sanitizeBody(req.body)
            });
        }
    });

    next();
};

module.exports = requestLogger;