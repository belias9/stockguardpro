/**
 * MongoDB Connection
 * Supports local (offline) and cloud (Atlas) with retry logic.
 */
const mongoose = require('mongoose');
const ENV = require('./environment');
const logger = require('../utils/logger');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

let retries = 0;

async function connectDB() {
    const uri = ENV.isCloud
        ? process.env.MONGODB_URI
        : process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/stockguardpro_local';

    if (!uri) {
        throw new Error('MONGODB_URI is not set in .env');
    }

    try {
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 50,
            minPoolSize: 5
        });

        retries = 0;
        logger.info(`[DB] Connected: ${conn.connection.host}`, {
            mode: ENV.mode,
            database: conn.connection.name,
            nodeVersion: process.versions.node
        });

        // Connection events
        mongoose.connection.on('error', (err) => {
            logger.error('[DB] Connection error:', err.message);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('[DB] Disconnected. Attempting reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('[DB] Reconnected');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            logger.info('[DB] Connection closed on app shutdown');
            process.exit(0);
        });

        return conn;
    } catch (err) {
        retries++;
        logger.error(`[DB] Connection failed (attempt ${retries}/${MAX_RETRIES}):`, err.message);

        if (retries >= MAX_RETRIES) {
            logger.error('[DB] Max retries reached. Exiting.');
            process.exit(1);
        }

        logger.info(`[DB] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        return connectDB();
    }
}

async function disconnectDB() {
    try {
        await mongoose.connection.close();
        logger.info('[DB] Disconnected cleanly');
    } catch (err) {
        logger.error('[DB] Disconnect error:', err.message);
    }
}

module.exports = { connectDB, disconnectDB };