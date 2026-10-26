// backend/models/Communication.js
const mongoose = require('mongoose');

const communicationSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    threadId: { type: String, required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientName: { type: String, required: true },
    type: { type: String, enum: ['complaint', 'request', 'general', 'urgent', 'feedback', 'salary_dispute', 'leave_request'], required: true },
    subject: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 5000 },
    attachments: [{ filename: String, url: String, size: Number, mimeType: String, uploadedAt: { type: Date, default: Date.now } }],
    status: { type: String, enum: ['unread', 'read', 'in_progress', 'resolved', 'closed', 'escalated'], default: 'unread' },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    responses: [{
        responder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        responderName: { type: String, required: true },
        responderRole: { type: String, required: true },
        message: { type: String, required: true },
        attachments: [{ filename: String, url: String }],
        timestamp: { type: Date, default: Date.now },
        isInternal: { type: Boolean, default: false }
    }],
    resolution: {
        resolvedAt: Date,
        resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        resolution: String,
        actionTaken: String,
        satisfaction: { type: String, enum: ['satisfied', 'unsatisfied', 'pending'] }
    },
    isPrivate: { type: Boolean, default: true },
    readAt: Date,
    readBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

communicationSchema.index({ threadId: 1, createdAt: 1 });
communicationSchema.index({ recipient: 1, status: 1 });
communicationSchema.index({ sender: 1, createdAt: -1 });
communicationSchema.index({ company: 1, branch: 1 });

module.exports = mongoose.model('Communication', communicationSchema);