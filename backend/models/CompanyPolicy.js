const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, maxlength: 20000 },
    kind: { type: String, enum: ['policy', 'regulation', 'certificate'], default: 'policy' },
    documentUrl: { type: String, default: '', maxlength: 1200 },
    fileName: { type: String, default: '', maxlength: 180 },
    contentType: { type: String, default: '', maxlength: 100 },
    fileData: { type: Buffer, default: undefined, select: false },
    version: { type: Number, default: 1, min: 1 },
    requiresAcknowledgment: { type: Boolean, default: true },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    acknowledgments: [{
        employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        acknowledgedAt: { type: Date, default: Date.now },
        ipAddress: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        version: { type: Number, required: true }
    }]
}, { timestamps: true });

policySchema.index({ company: 1, active: 1, kind: 1 });
module.exports = mongoose.model('CompanyPolicy', policySchema);
