/**
 * StockGuardPro — Server (S28 build)
 * Wires all middleware, routes, and Socket.IO.
 */
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { createServer } = require('http');

const ENV = require('./config/environment');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');

// Middleware
const { sanitize } = require('./middleware/sanitizers');
const { globalLimiter } = require('./middleware/rateLimiter');
const { branchContext } = require('./middleware/branchContext');
const requestLogger = require('./middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Socket.IO
const { initSocket } = require('./config/socket');

// Routes
const healthRoute = require('./routes/health');

const app = express();
const httpServer = createServer(app);

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
            connectSrc: ["'self'", 'ws:', 'wss:'],
            fontSrc: ["'self'", 'https:', 'data:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"]
        }
    } : false,
    crossOriginEmbedderPolicy: false
}));

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
// ============================================================
// WhatsApp Webhook — MUST be before express.json()
// Needs raw body for signature verification
// ============================================================
const whatsappService = require('./services/whatsappService');
const webhookRaw = express.raw({ type: 'application/json', limit: '1mb' });

app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        logger.info('[WhatsApp] Webhook verified');
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

app.post('/api/whatsapp/webhook', webhookRaw, (req, res) => {
    res.status(200).send('EVENT_RECEIVED');
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = req.body.toString('utf8');
    if (!whatsappService.verifyWebhookSignature(rawBody, signature)) {
        logger.warn('[WhatsApp] Invalid webhook signature — dropped');
        return;
    }
    try {
        const body = JSON.parse(rawBody);
        if (body.entry) {
            for (const entry of body.entry) {
                for (const change of entry.changes || []) {
                    for (const message of change.value?.messages || []) {
                        logger.info('[WhatsApp] Incoming', {
                            from: message.from,
                            type: message.type,
                            text: message.text?.body?.substring(0, 100)
                        });
                    }
                }
            }
        }
    } catch (err) {
        logger.error('[WhatsApp] Webhook parse error:', err.message);
    }
});
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
// 8. Socket.IO (initialize BEFORE routes so req.io is available)
// ============================================================
const io = initSocket(httpServer);
app.set('io', io);
app.use((req, res, next) => {
    req.io = io;
    next();
});

// ============================================================
// 9. Routes
// ============================================================
app.use('/api/health', healthRoute);

// Auth
app.use('/api/auth', require('./routes/shared/auth'));

// Employer
app.use('/api/branches', require('./routes/employer/branches'));
app.use('/api/warehouses', require('./routes/employer/warehouses'));
app.use('/api/users', require('./routes/employer/users'));
app.use('/api/audit', require('./routes/employer/audit'));

// Employee
app.use('/api/inventory', require('./routes/employee/stock/inventory'));
app.use('/api/receipts', require('./routes/employee/sales/receipts'));
app.use('/api/withdrawals', require('./routes/employee/sales/withdrawals'));
app.use('/api/cashier', require('./routes/employee/cashier/payments'));
app.use('/api/pre-records', require('./routes/employee/shop_buyer/pre-records'));
app.use('/api/inventory-mode', require('./routes/employee/manager/inventory-mode'));

// Shared
// Integrations
app.use('/api/ai', require('./routes/shared/ai'));
app.use('/api/whatsapp', require('./routes/shared/whatsapp'));
app.use('/api/communication', require('./routes/shared/communication'));
app.use('/api/attendance', require('./routes/shared/attendance'));
app.use('/api/salary', require('./routes/shared/salary'));
app.use('/api/customers', require('./routes/shared/customers'));
app.use('/api/dashboard', require('./routes/shared/dashboard'));

// ============================================================
// 10. 404 handler (must be before error handler)
// ============================================================
app.use(notFoundHandler);

// ============================================================
// 11. Error handler (must be last)
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

        httpServer.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`, {
                mode: ENV.mode,
                env: process.env.NODE_ENV || 'development',
                security: {
                    helmet: true,
                    cors: true,
                    rateLimit: true,
                    sanitize: true,
                    branchContext: true
                },
                socketIO: {
                    enabled: true,
                    rooms: ['company', 'branch', 'user']
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