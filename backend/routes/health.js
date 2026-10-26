/**
 * Health Check Endpoint
 * Reports server status, DB state, environment, and version.
 */
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const ENV = require('../config/environment');

const DB_STATES = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
};

router.get('/', (req, res) => {
    const dbState = DB_STATES[mongoose.connection.readyState] || 'unknown';
    const healthy = mongoose.connection.readyState === 1;

    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'OK' : 'DEGRADED',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: {
            mode: ENV.mode,
            nodeEnv: process.env.NODE_ENV || 'development',
            nodeVersion: process.versions.node,
            branchId: ENV.branchId
        },
        database: {
            state: dbState,
            host: mongoose.connection.host || null,
            database: mongoose.connection.name || null
        },
        features: {
            ai: !!process.env.OPENAI_API_KEY,
            whatsapp: !!process.env.WHATSAPP_ACCESS_TOKEN,
            sync: process.env.SYNC_ENABLED === 'true'
        },
        uptime: Math.floor(process.uptime()) + 's'
    });
});

module.exports = router;