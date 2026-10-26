const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const whatsappService = require('../../services/whatsappService');

// NOTE: Webhook (GET/POST) is mounted in server.js BEFORE express.json()
// because it needs the raw body for signature verification.

router.use(protect);

router.post('/send-receipt', async (req, res, next) => {
    try {
        const { receipt, customerPhone } = req.body;
        const result = await whatsappService.sendReceipt(receipt, customerPhone);
        res.json({ success: result.success, messageId: result.messageId, error: result.error });
    } catch (err) { next(err); }
});

router.post('/stock-alert', async (req, res, next) => {
    try {
        const { item, recipientPhone } = req.body;
        const result = await whatsappService.sendStockAlert(item, recipientPhone);
        res.json({ success: result.success, messageId: result.messageId, error: result.error });
    } catch (err) { next(err); }
});

router.post('/withdrawal-notify', async (req, res, next) => {
    try {
        const { withdrawal, recipientPhone, type } = req.body;
        const result = await whatsappService.sendWithdrawalNotification(withdrawal, recipientPhone, type);
        res.json({ success: result.success, messageId: result.messageId, error: result.error });
    } catch (err) { next(err); }
});

router.post('/salary-notify', authorize('employer'), async (req, res, next) => {
    try {
        const { employeePhone, salary, type } = req.body;
        const result = await whatsappService.sendSalaryNotification(employeePhone, salary, type);
        res.json({ success: result.success, messageId: result.messageId, error: result.error });
    } catch (err) { next(err); }
});

router.post('/message-notify', async (req, res, next) => {
    try {
        const { recipientPhone, senderName, subject, messagePreview } = req.body;
        const result = await whatsappService.sendMessageNotification(recipientPhone, senderName, subject, messagePreview);
        res.json({ success: result.success, messageId: result.messageId, error: result.error });
    } catch (err) { next(err); }
});

router.get('/status', authorize('employer'), (req, res) => {
    res.json({
        success: true,
        configured: whatsappService.isConfigured(),
        phoneNumberId: whatsappService.isConfigured() ? process.env.WHATSAPP_PHONE_NUMBER_ID : null,
        message: whatsappService.isConfigured() ? 'WhatsApp is active' : 'WhatsApp not configured'
    });
});

module.exports = router;