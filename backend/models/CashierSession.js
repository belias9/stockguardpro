/**
 * CashierSession Model
 * One cashier's daily session — tracks all money received.
 * Profit is computed server-side and hidden from cashier.
 */
const mongoose = require('mongoose');

const STATUS = ['open', 'closed'];

const cashierSessionSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },

    // ============ Cashier ============
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cashierName: { type: String, required: true },

    // ============ Date (normalized to midnight) ============
    date: { type: Date, required: true, index: true },

    // ============ Status ============
    status: { type: String, enum: STATUS, default: 'open', index: true },

    // ============ Transactions ============
    transactions: [{
        receipt: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', required: true },
        receiptId: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 },
        cost: { type: Number, required: true, min: 0 },        // hidden from cashier
        profit: { type: Number, required: true },              // hidden from cashier
        paymentMethod: { type: String, required: true },
        confirmedAt: { type: Date, default: new Date() },
        disputed: { type: Boolean, default: false }
    }],

    // ============ Totals ============
    totals: {
        transactionCount: { type: Number, default: 0 },
        totalReceived: { type: Number, default: 0, min: 0 },
        totalCost: { type: Number, default: 0, min: 0 },        // hidden from cashier
        totalProfit: { type: Number, default: 0 },              // hidden from cashier
        profitMargin: { type: Number, default: 0 },             // hidden from cashier
        disputedCount: { type: Number, default: 0 },
        pendingCount: { type: Number, default: 0 },
        averageTicket: { type: Number, default: 0 }
    },

    // ============ Opening / closing ============
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },

    // ============ Notes ============
    notes: { type: String, default: '' },

    // ============ Metadata ============
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ============================================================
// Indexes
// ============================================================
// One session per cashier per day
cashierSessionSchema.index({ cashier: 1, date: 1 }, { unique: true });
cashierSessionSchema.index({ company: 1, branch: 1, date: -1 });
cashierSessionSchema.index({ company: 1, status: 1, date: -1 });

// ============================================================
// Pre-validate: normalize date
// ============================================================
cashierSessionSchema.pre('validate', function (next) {
    if (this.date) {
        const d = new Date(this.date);
        d.setHours(0, 0, 0, 0);
        this.date = d;
    }
    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Methods
// ============================================================
cashierSessionSchema.methods.addTransaction = function ({ receipt, receiptId, amount, cost, paymentMethod }) {
    if (this.status === 'closed') throw new Error('Session is closed — cannot add transactions');
    
    const profit = amount - cost;
    this.transactions.push({
        receipt,
        receiptId,
        amount,
        cost,
        profit,
        paymentMethod,
        confirmedAt: new Date()
    });
    
    this.recalculateTotals();
};

cashierSessionSchema.methods.recalculateTotals = function () {
    const confirmed = this.transactions.filter(t => !t.disputed);
    
    this.totals.transactionCount = confirmed.length;
    this.totals.totalReceived = confirmed.reduce((s, t) => s + t.amount, 0);
    this.totals.totalCost = confirmed.reduce((s, t) => s + t.cost, 0);
    this.totals.totalProfit = this.totals.totalReceived - this.totals.totalCost;
    this.totals.profitMargin = this.totals.totalReceived > 0
        ? (this.totals.totalProfit / this.totals.totalReceived) * 100
        : 0;
    this.totals.disputedCount = this.transactions.filter(t => t.disputed).length;
    this.totals.averageTicket = this.totals.transactionCount > 0
        ? this.totals.totalReceived / this.totals.transactionCount
        : 0;
};

cashierSessionSchema.methods.close = function (notes = '') {
    if (this.status === 'closed') throw new Error('Session already closed');
    this.status = 'closed';
    this.closedAt = new Date();
    this.notes = notes;
};

// ============================================================
// Role-aware serialization — CASHIER NEVER SEES PROFIT
// ============================================================
cashierSessionSchema.methods.toPublicJSON = function (viewerRole = 'cashier') {
    const base = {
        id: this._id,
        cashier: this.cashier,
        cashierName: this.cashierName,
        date: this.date,
        status: this.status,
        openedAt: this.openedAt,
        closedAt: this.closedAt,
        notes: this.notes,
        totals: {
            transactionCount: this.totals.transactionCount,
            totalReceived: this.totals.totalReceived,
            disputedCount: this.totals.disputedCount,
            pendingCount: this.totals.pendingCount,
            averageTicket: this.totals.averageTicket
        },
        transactions: this.transactions.map(t => ({
            receiptId: t.receiptId,
            amount: t.amount,
            paymentMethod: t.paymentMethod,
            confirmedAt: t.confirmedAt,
            disputed: t.disputed
        })),
        createdAt: this.createdAt
    };

    // Employer and manager see profit
    if (['employer', 'manager'].includes(viewerRole)) {
        base.totals.totalCost = this.totals.totalCost;
        base.totals.totalProfit = this.totals.totalProfit;
        base.totals.profitMargin = this.totals.profitMargin;
        base.transactions = this.transactions;
    }

    // Cashier explicitly NEVER sees cost or profit
    return base;
};

cashierSessionSchema.set('toJSON', { virtuals: true });
cashierSessionSchema.set('toObject', { virtuals: true });

cashierSessionSchema.statics.STATUS = STATUS;

module.exports = mongoose.model('CashierSession', cashierSessionSchema);