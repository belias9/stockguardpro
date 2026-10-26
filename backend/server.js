require('dotenv').config();
const express = require('express');
const ENV = require('./config/environment');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');
const healthRoute = require('./routes/health');

const app = express();
app.use(express.json());
app.use('/api/health', healthRoute);

const PORT = process.env.PORT || 5000;

async function start() {
    try {
        ENV.validate();
        await connectDB();
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`, {
                mode: ENV.mode,
                env: process.env.NODE_ENV || 'development'
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