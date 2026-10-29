/**
 * Email Service
 * In dev: logs email to console
 * In prod: uses Nodemailer with SMTP
 */
const logger = require('./logger');

let nodemailer = null;
let transporter = null;

function isConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function initTransporter() {
    if (!isConfigured()) return null;
    if (transporter) return transporter;
    
    try {
        nodemailer = nodemailer || require('nodemailer');
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        return transporter;
    } catch (err) {
        logger.error('[Email] Failed to init transporter:', err.message);
        return null;
    }
}

async function send({ to, subject, html, text }) {
    const t = initTransporter();
    
    // Dev mode or not configured → log to console
    if (!t) {
        logger.info('[Email] DEV MODE — Email not sent (SMTP not configured)', { to, subject });
        console.log('\n=========================================');
        console.log('📧 EMAIL (DEV MODE)');
        console.log('=========================================');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('-----------------------------------------');
        console.log(text || html.replace(/<[^>]*>/g, ''));
        console.log('=========================================\n');
        return { success: true, dev: true };
    }
    
    try {
        const info = await t.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'StockGuardPro'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '')
        });
        logger.info('[Email] Sent', { to, messageId: info.messageId });
        return { success: true, messageId: info.messageId };
    } catch (err) {
        logger.error('[Email] Send failed:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = { send, isConfigured };