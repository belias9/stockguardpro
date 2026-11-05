const mongoose = require('mongoose');

const journalLineSchema = new mongoose.Schema({
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    description: { type: String, trim: true, maxlength: 250, default: '' }
}, { _id: false });

const journalEntrySchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    entryDate: { type: Date, required: true, index: true },
    memo: { type: String, required: true, trim: true, maxlength: 500 },
    reference: { type: String, trim: true, maxlength: 120, default: '' },
    source: { type: String, enum: ['manual', 'accounting_entry', 'receipt'], default: 'manual' },
    sourceAccountingEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingEntry', default: null },
    sourceReceipt: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', default: null },
    lines: { type: [journalLineSchema], validate: { validator: v => v.length >= 2, message: 'A journal entry needs at least two lines' } },
    totalDebit: { type: Number, required: true, min: 0 },
    totalCredit: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'posted', 'rejected', 'reversed'], default: 'posted', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' }
}, { timestamps: true });

journalEntrySchema.index({ company: 1, sourceAccountingEntry: 1 }, { unique: true, partialFilterExpression: { sourceAccountingEntry: { $type: 'objectId' } } });
journalEntrySchema.index({ company: 1, sourceReceipt: 1 }, { unique: true, partialFilterExpression: { sourceReceipt: { $type: 'objectId' } } });
journalEntrySchema.index({ company: 1, branch: 1, entryDate: -1 });
journalEntrySchema.pre('validate', function (next) {
    const debitCents = this.lines.reduce((sum, line) => sum + Math.round((line.debit || 0) * 100), 0);
    const creditCents = this.lines.reduce((sum, line) => sum + Math.round((line.credit || 0) * 100), 0);
    this.totalDebit = debitCents / 100;
    this.totalCredit = creditCents / 100;
    if (debitCents !== creditCents) return next(new Error('Journal entry debits must equal credits'));
    if (this.lines.some(line => (line.debit > 0) === (line.credit > 0))) return next(new Error('Each journal line must contain either a debit or a credit'));
    next();
});

journalEntrySchema.plugin(require('../plugins/offlineSync'));
module.exports = mongoose.model('JournalEntry', journalEntrySchema);
