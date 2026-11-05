const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const whatsappService = require('../../services/whatsappService');
const Company = require('../../models/company');
const WhatsAppAnalysis = require('../../models/WhatsAppAnalysis');
const auditHelper = require('../../utils/auditHelper');

// NOTE: Webhook (GET/POST) is mounted in server.js BEFORE express.json()
// because it needs the raw body for signature verification.

router.use(protect);

router.put('/group-settings', authorize('employer'), async (req, res, next) => {
    try {
        const phoneNumberId = String(req.body.phoneNumberId || '').trim().slice(0, 80);
        const monitoredGroupIds = Array.isArray(req.body.monitoredGroupIds) ? [...new Set(req.body.monitoredGroupIds.map(x => String(x).trim()).filter(Boolean))].slice(0, 30) : [];
        const enabled = req.body.enabled === true;
        if (enabled && (!phoneNumberId || !monitoredGroupIds.length)) return res.status(400).json({ success: false, error: 'Add the WhatsApp phone number ID and at least one group ID before enabling analysis' });
        const company = await Company.findById(req.user.company);
        company.whatsappIntegration = { phoneNumberId, monitoredGroupIds, groupAnalysisEnabled: enabled };
        await company.save();
        await auditHelper.log(req, { action: 'WHATSAPP_GROUP_ANALYSIS_SETTINGS', entityType: 'Company', entityId: company._id, entityName: company.name });
        res.json({ success: true, enabled, monitoredGroupCount: monitoredGroupIds.length });
    } catch (err) { next(err); }
});

router.get('/analysis', authorize('employer'), async (req, res, next) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
        const records = await WhatsAppAnalysis.find({ company: req.user.company }).select('-text -senderId').sort({ receivedAt: -1 }).limit(limit).lean();
        res.json({ success: true, records });
    } catch (err) { next(err); }
});

router.post('/analysis/:id/reanalyze', authorize('employer'), async (req,res,next)=>{
    try {
        const record=await WhatsAppAnalysis.findOne({_id:req.params.id,company:req.user.company});
        if(!record)return res.status(404).json({success:false,error:'Analysis record not found'});
        if(!record.text)return res.status(400).json({success:false,error:'This message has no readable text or caption'});
        const result=await require('../../services/aiService').analyzeWhatsAppGroupMessage(record.text);
        record.analysis=result;record.status=result.available?'analyzed':'failed';await record.save();
        await auditHelper.log(req,{action:'WHATSAPP_MESSAGE_REANALYZED',entityType:'WhatsAppAnalysis',entityId:record._id,entityName:record.messageId});
        res.json({success:true,record:{id:record._id,status:record.status,analysis:record.analysis}});
    }catch(err){next(err);}
});

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
