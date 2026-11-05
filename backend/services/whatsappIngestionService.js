const Company = require('../models/company');
const WhatsAppAnalysis = require('../models/WhatsAppAnalysis');
const aiService = require('./aiService');
const logger = require('../utils/logger');

async function processWebhookBody(body) {
    let stored = 0;
    for (const entry of body.entry || []) for (const change of entry.changes || []) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;
        const company = await Company.findOne({ 'whatsappIntegration.phoneNumberId': phoneNumberId, 'whatsappIntegration.groupAnalysisEnabled': true }).select('_id whatsappIntegration.monitoredGroupIds');
        if (!company) continue;
        for (const message of value.messages || []) {
            // Only analyze group messages explicitly marked by the provider.
            const groupId = message.group_id || message.context?.group_id || '';
            if (!groupId || !company.whatsappIntegration.monitoredGroupIds.includes(groupId)) continue;
            const text = message.text?.body || message.image?.caption || message.document?.caption || message.video?.caption || '';
            let record;
            try {
                record = await WhatsAppAnalysis.create({ company: company._id, phoneNumberId, groupId, messageId: message.id, senderId: message.from || '', messageType: message.type || 'unknown', text: String(text).slice(0, 5000), receivedAt: new Date(Number(message.timestamp || Date.now() / 1000) * 1000), status: text ? 'received' : 'unsupported' });
            } catch (err) { if (err.code === 11000) continue; throw err; }
            if (text) {
                record.analysis = await aiService.analyzeWhatsAppGroupMessage(text);
                record.status = record.analysis?.available === false ? 'failed' : 'analyzed';
                await record.save();
            }
            stored++;
        }
    }
    return { stored };
}

module.exports = { processWebhookBody };
