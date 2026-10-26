/**
 * Global Error Handler
 * Normalizes all errors. Never leaks stack in production.
 */
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    // Log full error internally
    logger.error('[Error]', {
        message: err.message,
        name: err.name,
        code: err.code,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: req.user?._id?.toString()
    });

    // Default values
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // ============ Mongoose Validation ============
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors).map(e => e.message).join(', ');
    }

    // ============ Mongoose Duplicate Key ============
    if (err.code === 11000) {
        statusCode = 400;
        const field = Object.keys(err.keyPattern || {})[0] || 'field';
        message = `Duplicate value for ${field}`;
    }

    // ============ Mongoose Cast Error ============
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.path}`;
    }

    // ============ JWT Errors ============
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    // ============ Multer (file upload) ============
    if (err.name === 'MulterError') {
        statusCode = 400;
        message = err.code === 'LIMIT_FILE_SIZE'
            ? 'File too large'
            : 'File upload error';
    }

    // Response
    const response = {
        success: false,
        error: message
    };

    // Only include stack in development
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    // Only include field errors if validation
    if (err.errors) {
        response.fields = err.errors;
    }

    res.status(statusCode).json(response);
};

// 404 handler (must be registered AFTER all routes)
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route not found: ${req.method} ${req.originalUrl}`
    });
};

module.exports = { errorHandler, notFoundHandler };