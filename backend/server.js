/**
 * StockGuardPro — Server (S03 build)
 * Wires all middleware in the correct order.
 */
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const ENV = require('./config/environment');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');

// Middleware
const { sanitize } = require('./middleware/sanitizers');
const { globalLimiter } = require('./middleware/rateLimiter');
const { branchContext } = require('./middleware/branchContext');
const requestLogger = require('./middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Routes
const healthRoute = require('./routes/health');

const app = express();

// ============================================================
// 1. Security headers (helmet)
// ============================================================
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", 'https:', 'data:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"]
        }
    } : false, // Disable CSP in dev for convenience
    crossOriginEmbedderPolicy: false
}));

// Disable x-powered-by
app.disable('x-powered-by');

// ============================================================
// 2. CORS
// ============================================================
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Branch-Id', 'X-Device-Key'],
    maxAge: 86400
}));

// ============================================================
// 3. Body parsing (with size limit)
// ============================================================
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ============================================================
// 4. Sanitizers (NoSQL injection + XSS)
// ============================================================
app.use(sanitize);

// ============================================================
// 5. Request logging
// ============================================================
app.use(requestLogger);

// ============================================================
// 6. Rate limiting (global)
// ============================================================
app.use('/api', globalLimiter);

// ============================================================
// 7. Branch context (runs after auth sets req.user in routes)
// ============================================================
app.use(branchContext);

// ============================================================
// 8. Routes
// ============================================================
app.use('/api/health', healthRoute);

// Future routes will go here:
// app.use('/api/auth', require('./routes/shared/auth'));
// app.use('/api/company', require('./routes/shared/company'));
// ...

// ============================================================
// 9. 404 handler (must be before error handler)
// ============================================================
app.use(notFoundHandler);

// ============================================================
// 10. Error handler (must be last)
// ============================================================
app.use(errorHandler);

// ============================================================
// Start server
// ============================================================
const PORT = process.env.PORT || 5000;

async function start() {
    try {
        ENV.validate();
        await connectDB();

        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`, {
                mode: ENV.mode,
                env: process.env.NODE_ENV || 'development',
                security: {
                    helmet: true,
                    cors: true,
                    rateLimit: true,
                    sanitize: true,
                    branchContext: true
                }
            });
        });
    } catch (err) {
        console.error('\n========== STARTUP ERROR ==========');
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
        console.error('===================================\n');
        process.exit(1);
    }
}

start();