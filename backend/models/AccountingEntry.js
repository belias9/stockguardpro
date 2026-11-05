const mongoose = require('mongoose');

const accountingEntrySchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    type: { type: String, enum: ['income', 'expense', 'credit_sale', 'credit_payment', 'loan_received', 'loan_repayment', 'loan_issued', 'loan_recovered'], required: true },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true, index: true },
    reference: { type: String, trim: true, maxlength: 120, default: '' },
    counterparty: { type: String, trim: true, maxlength: 160, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' }
}, { timestamps: true });

accountingEntrySchema.index({ company: 1, branch: 1, date: -1 });
accountingEntrySchema.plugin(require('../plugins/offlineSync'));
module.exports = mongoose.model('AccountingEntry', accountingEntrySchema);
