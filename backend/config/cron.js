/**
 * Cron Jobs
 * Runs daily automated tasks.
 */
const cron = require('node-cron');
const logger = require('../utils/logger');

function startCronJobs() {
    // Auto-mark absent employees at 23:59
    cron.schedule('59 23 * * *', async () => {
        try {
            logger.info('[Cron] Running attendance auto-mark');
            const attendanceService = require('../services/attendanceService');
            const result = await attendanceService.autoMarkAbsent();
            logger.info('[Cron] Auto-marked', result);
        } catch (err) {
            logger.error('[Cron] Auto-mark failed:', err.message);
        }
    });

    // Generate salaries on 1st of month at 00:00
    cron.schedule('0 0 1 * *', async () => {
        try {
            logger.info('[Cron] Auto-generating salaries');
            const now = new Date();
            const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
            const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            // Actual generation needs employer context — skip auto-generation, only notify
            logger.info(`[Cron] Reminder: Generate salaries for ${prevYear}-${prevMonth}`);
        } catch (err) {
            logger.error('[Cron] Salary reminder failed:', err.message);
        }
    });

    logger.info('[Cron] Jobs started');
}

module.exports = { startCronJobs };