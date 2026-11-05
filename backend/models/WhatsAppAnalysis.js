const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    phoneNumberId: { type: String, required: true, index: true },
    groupId: { type: String, required: true, index: true },
    messageId: { type: String, required: true },
    senderId: { type: String, default: '' },
    messageType: { type: String, default: 'text' },
    text: { type: String, default: '', maxlength: 5000 },
    receivedAt: { type: Date, default: Date.now },
    analysis: { type: mongoose.Schema.Types.Mixed, default: null },
    status: { type: String, enum: ['received', 'analyzed', 'unsupported', 'failed'], default: 'received' },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 86400000), index: { expires: 0 } }
}, { timestamps: true });
schema.index({ company: 1, messageId: 1 }, { unique: true });
module.exports = mongoose.model('WhatsAppAnalysis', schema);
