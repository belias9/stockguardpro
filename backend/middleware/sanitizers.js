/**
 * Sanitizers
 * NoSQL injection protection + XSS prevention.
 * Applied globally to all requests.
 */
const mongoSanitize = require('express-mongo-sanitize');

// ============================================================
// NoSQL injection protection
// Strips $ and . from keys in req.body, req.query, req.params
// ============================================================
const noSqlSanitizer = mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        const logger = require('../utils/logger');
        logger.warn('[Sanitize] NoSQL injection attempt', {
            key,
            ip: req.ip,
            path: req.originalUrl,
            userId: req.user?._id?.toString()
        });
    }
});

// ============================================================
// XSS protection
// Strips HTML tags from user input. Manual impl (xss-clean is deprecated).
// ============================================================
const xssSanitizer = (req, res, next) => {
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            // Remove <script>, <iframe>, and event handlers
            return obj
                .replace(/<script[^>]*>.*?<\/script>/gi, '')
                .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
                .replace(/javascript:/gi, '');
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitize);
        }
        if (obj && typeof obj === 'object') {
            const clean = {};
            for (const key of Object.keys(obj)) {
                clean[key] = sanitize(obj[key]);
            }
            return clean;
        }
        return obj;
    };

    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);
    next();
};

// ============================================================
// Combined sanitizer (call both in order)
// ============================================================
const sanitize = [noSqlSanitizer, xssSanitizer];

module.exports = { sanitize, noSqlSanitizer, xssSanitizer };