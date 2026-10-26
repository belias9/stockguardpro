/**
 * EndOfDayReport Model
 * Daily summary sent to employer.
 * Immutable after sent.
 */
const mongoose = require('mongoose');

const DELIVERY_STATUS = ['pending', 'sent', 'failed', 'partial'];

const endOfDayReportSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },

    // ============ Date ============
    date: { type: Date, required: true, index: true },
    reportDate: { type: String, required: true },  // YYYY-MM-DD (human readable)

    // ============ Goods bought (shop buyer) ============
    goodsBought: {
        totalPreRecords: { type: Number, default: 0 },
        confirmed: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
        rejected: { type: Number, default: 0 },
        totalCost: { type: Number, default: 0, min: 0 },
        items: [{
            preRecordId: String,
            buyerName: String,
            itemCount: Number,
            totalCost: Number,
            status: String
        }]
    },

    // ============ Attendance ============
    attendance: {
        totalEmployees: { type: Number, default: 0 },
        present: { type: Number, default: 0 },
        late: { type: Number, default: 0 },
        absent: { type: Number, default: 0 },
        onLeave: { type: Number, default: 0 },
        notClocked: { type: Number, default: 0 },
        attendanceRate: { type: Number, default: 0 }
    },

    // ============ Faulty goods ============
    faultyGoods: {
        soldNotCollected: [{
            receiptId: String,
            customerName: String,
            amount: Number,
            daysPending: Number
        }],
        collectedNotSold: [{
            withdrawalId: String,
            itemName: String,
            quantity: Number,
            daysPending: Number
        }],
        soldNotCollectedCount: { type: Number, default: 0 },
        collectedNotSoldCount: { type: Number, default: 0 }
    },

    // ============ Cashier ============
    cashier: {
        totalSessions: { type: Number, default: 0 },
        totalTransactions: { type: Number, default: 0 },
        totalReceived: { type: Number, default: 0, min: 0 },
        totalCost: { type: Number, default: 0, min: 0 },        // employer only
        totalProfit: { type: Number, default: 0 },              // employer only
        profitMargin: { type: Number, default: 0 },             // employer only
        totalDisputed: { type: Number, default: 0 },
        totalPending: { type: Number, default: 0 },
        perCashier: [{
            cashierName: String,
            transactions: Number,
            totalReceived: Number,
            totalProfit: Number,
            disputed: Number
        }]
    },

    // ============ Transfers / Withdrawals ============
    transfers: {
        pending: { type: Number, default: 0 },
        inTransit: { type: Number, default: 0 },
        completedToday: { type: Number, default: 0 },
        totalValue: { type: Number, default: 0, min: 0 }
    },

    // ============ Inventory alerts ============
    inventoryAlerts: {
        lowStockCount: { type: Number, default: 0 },
        outOfStockCount: { type: Number, default: 0 },
        lowStockItems: [{
            itemCode: String,
            itemName: String,
            quantity: Number,
            reorderPoint: Number,
            warehouse: String
        }]
    },

    // ============ AI insights ============
    aiInsights: {
        slowMovingItems: [{ itemName: String, daysUnsold: Number }],
        fastMovingItems: [{ itemName: String, totalSold: Number }],
        recommendations: [String]
    },

    // ============ Delivery ============
    delivery: {
        status: { type: String, enum: DELIVERY_STATUS, default: 'pending', index: true },
        inAppSentAt: { type: Date, default: null },
        whatsappSentAt: { type: Date, default: null },
        whatsappMessageId: { type: String, default: null },
        attempts: { type: Number, default: 0 },
        lastAttemptAt: { type: Date, default: null },
        error: { type: String, default: null }
    },

    // ============ Lock after send ============
    locked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },

    // ============ Metadata ============
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ============================================================
// Indexes
// ============================================================
// One report per branch per day
endOfDayReportSchema.index({ branch: 1, date: 1 }, { unique: true });
endOfDayReportSchema.index({ company: 1, date: -1 });
endOfDayReportSchema.index({ company: 1, 'delivery.status': 1 });

// ============================================================
// Pre-validate: normalize date
// ============================================================
endOfDayReportSchema.pre('validate', function (next) {
    if (this.date) {
        const d = new Date(this.date);
        d.setHours(0, 0, 0, 0);
        this.date = d;
        this.reportDate = d.toISOString().slice(0, 10);
    }
    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Pre-save: prevent modification after locked
// ============================================================
endOfDayReportSchema.pre('save', function (next) {
    // Only enforce lock on NON-NEW docs that were ALREADY locked before this save
    if (this.isNew) return next();

    // If the doc was already locked in the DB, block modifications
    // (We use `_wasLocked` set by a middleware — simpler: allow first save, block subsequent)
    if (this.locked && !this.$locals.allowLockedSave) {
        const allowed = [
            'delivery.whatsappSentAt', 'delivery.whatsappMessageId',
            'delivery.attempts', 'delivery.lastAttemptAt', 'delivery.error',
            'delivery.status'
        ];
        const modified = this.modifiedPaths();
        const onlyDelivery = modified.every(p => allowed.some(a => p.startsWith('delivery') || p === a));
        if (!onlyDelivery) {
            return next(new Error('Report is locked and cannot be modified'));
        }
    }
    next();
});

// ============================================================
// Methods
// ============================================================
endOfDayReportSchema.methods.markSent = function (channel, messageId = null) {
    this.$locals.allowLockedSave = true;  // ✅ allow THIS save to go through
    if (channel === 'in_app') {
        this.delivery.inAppSentAt = new Date();
    } else if (channel === 'whatsapp') {
        this.delivery.whatsappSentAt = new Date();
        this.delivery.whatsappMessageId = messageId;
    }
    this.delivery.attempts += 1;
    this.delivery.lastAttemptAt = new Date();
    this.delivery.status = 'sent';
    this.locked = true;
    this.lockedAt = new Date();
};

endOfDayReportSchema.methods.markFailed = function (error) {
    this.delivery.attempts += 1;
    this.delivery.lastAttemptAt = new Date();
    this.delivery.error = error;
    this.delivery.status = 'failed';
};

// ============================================================
// Serialization — employer-only view includes profit
// ============================================================
endOfDayReportSchema.methods.toPublicJSON = function () {
    // This report is ALWAYS sent to employer
    // So this always includes profit
    return {
        id: this._id,
        date: this.date,
        reportDate: this.reportDate,
        branch: this.branch,
        goodsBought: this.goodsBought,
        attendance: this.attendance,
        faultyGoods: this.faultyGoods,
        cashier: this.cashier,   // includes profit (employer-only)
        transfers: this.transfers,
        inventoryAlerts: this.inventoryAlerts,
        aiInsights: this.aiInsights,
        delivery: this.delivery,
        locked: this.locked,
        createdAt: this.createdAt
    };
};

endOfDayReportSchema.set('toJSON', { virtuals: true });
endOfDayReportSchema.set('toObject', { virtuals: true });

endOfDayReportSchema.statics.DELIVERY_STATUS = DELIVERY_STATUS;

module.exports = mongoose.model('EndOfDayReport', endOfDayReportSchema);