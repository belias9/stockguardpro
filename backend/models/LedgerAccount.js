const mongoose = require('mongoose');

const ledgerAccountSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ['asset', 'liability', 'equity', 'income', 'expense'], required: true },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

ledgerAccountSchema.index({ company: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('LedgerAccount', ledgerAccountSchema);
