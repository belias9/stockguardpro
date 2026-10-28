/**
 * Branch LAN Server
 * Runs on a local PC at each branch.
 * Same code as cloud, but APP_MODE=local.
 */
require('dotenv').config();
process.env.APP_MODE = 'local';

const ENV = require('./config/environment');
const logger = require('./utils/logger');

if (!process.env.BRANCH_ID) {
    console.error('❌ BRANCH_ID is required for local server. Set in .env');
    process.exit(1);
}

logger.info('[Local Server] Starting in LOCAL mode', {
    branch: process.env.BRANCH_ID,
    cloud: process.env.CLOUD_API_URL || 'not configured'
});

// Start the sync worker
const syncService = require('./services/syncService');
syncService.startSyncWorker();

// Boot the normal server
require('./server');