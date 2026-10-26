/**
 * Rate Limiters
 * Global + per-route limits. Returns 429 with Retry-After.
 */
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// ============================================================
// Global limiter (all routes)
// ============================================================
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests. Please try again later.'
    },
    handler: (req, res, next, options) => {
        logger.warn('[Rate Limit] Global limit hit', {
            ip: req.ip,
            path: req.originalUrl,
            userId: req.user?._id?.toString()
        });
        res.status(429).json(options.message);
    }
});

// ============================================================
// Auth limiter — login endpoints (5 per 15 min per IP+email)
// ============================================================
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const email = req.body?.email || req.body?.name || 'unknown';
        return `${req.ip}-${email}`;
    },
    handler: (req, res) => {
        logger.warn('[Rate Limit] Auth limit hit', {
            ip: req.ip,
            email: req.body?.email,
            path: req.originalUrl
        });
        res.status(429).json({
            success: false,
            error: 'Too many login attempts. Try again in 15 minutes.'
        });
    }
});

// ============================================================
// AI limiter — 10 per minute per user
// ============================================================
const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?._id?.toString() || req.ip,
    handler: (req, res) => {
        logger.warn('[Rate Limit] AI limit hit', {
            userId: req.user?._id?.toString(),
            path: req.originalUrl
        });
        res.status(429).json({
            success: false,
            error: 'Too many AI requests. Please wait a minute.'
        });
    }
});

// ============================================================
// Write limiter — for create/update/delete actions
// 60 per hour per user
// ============================================================
const writeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?._id?.toString() || req.ip,
    handler: (req, res) => {
        logger.warn('[Rate Limit] Write limit hit', {
            userId: req.user?._id?.toString(),
            path: req.originalUrl
        });
        res.status(429).json({
            success: false,
            error: 'Too many write operations. Please wait.'
        });
    }
});

// ============================================================
// Export limiter — 5 per hour per user
// ============================================================
const exportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?._id?.toString() || req.ip,
    handler: (req, res) => {
        logger.warn('[Rate Limit] Export limit hit', {
            userId: req.user?._id?.toString()
        });
        res.status(429).json({
            success: false,
            error: 'Too many exports. Please wait an hour.'
        });
    }
});

module.exports = {
    globalLimiter,
    authLimiter,
    aiLimiter,
    writeLimiter,
    exportLimiter
};