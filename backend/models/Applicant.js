const mongoose = require('mongoose');

const applicantSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    position: { type: String, required: true, trim: true, maxlength: 120 },
    resumeText: { type: String, required: true, maxlength: 12000 },
    documents: [{ name: { type: String, maxlength: 120 }, url: { type: String, maxlength: 1000 } }],
    status: { type: String, enum: ['submitted', 'reviewed', 'shortlisted', 'rejected', 'hired'], default: 'submitted', index: true },
    aiRecommendation: { type: mongoose.Schema.Types.Mixed, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null }
}, { timestamps: true });

applicantSchema.index({ company: 1, email: 1, position: 1 });
module.exports = mongoose.model('Applicant', applicantSchema);
