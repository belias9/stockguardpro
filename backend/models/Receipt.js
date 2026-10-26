/**
 * Receipt Model
 * A sale transaction. May span multiple warehouses.
 * Triggers withdrawal if items come from different warehouse than store.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');

const PAYMENT_STATUS = ['pending', 'confirmed', 'disputed'];
const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'mobile_money', 'credit', 'mixed'];
const RECEIPT_STATUS = ['draft', 'finalized', 'cancelled', 'refunded'];
const WITHDRAWAL_STATUS = ['not_required', 'pending', 'approved', 'dispatched', 'completed', 'failed'];

const receiptSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true,
        index: true
    },

    // ============ Identity ============
    receiptId: {
        type: String,
        unique: true,
        required: true
        // Format: RCP-YYMMDD-XXXX
    },

    // ============ Items ============
    items: [{
        inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
        itemCode: { type: String, required: true },
        itemName: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unit: { type: String, required: true },
        unitPrice: { type: Number, required: true, min: 0 },
        unitCost: { type: Number, required: true, min: 0 },  // hidden from non-privileged
        totalPrice: { type: Number, required: true, min: 0 },
        discount: { type: Number, default: 0, min: 0 },
        tax: { type: Number, default: 0, min: 0 },
        // Origin tracking
        originWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
        originWarehouseName: { type: String, default: '' }
    }],

    // ============ Financial summary ============
    subtotal: { type: Number, required: true, min: 0 },
    totalDiscount: { type: Number, default: 0, min: 0 },
    totalTax: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, default: 0, min: 0 },        // employer-only
    totalProfit: { type: Number, default: 0 },              // employer-only

    // ============ Payment ============
    paymentMethod: {
        type: String,
        enum: PAYMENT_METHODS,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: PAYMENT_STATUS,
        default: 'pending',
        index: true
    },
    paymentDetails: {
        transactionId: String,
        bankName: String,
        cardLast4: String,
        mobileMoneyProvider: String,
        mobileMoneyNumber: String
    },
    cashierConfirmation: {
        confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        confirmedByName: { type: String, default: null },
        confirmedAt: { type: Date, default: null },
        notes: { type: String, default: '' },
        disputedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        disputedAt: { type: Date, default: null },
        disputeReason: { type: String, default: null }
    },

    // ============ Customer ============
    customer: {
        name: { type: String, default: 'Walk-in Customer' },
        phone: { type: String, default: '' },
        email: { type: String, default: '' },
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null }
    },

    // ============ Seller ============
    soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    soldByName: { type: String, required: true },
    storeLocation: { type: String, required: true },

    // ============ Withdrawal link ============
    withdrawalRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'Withdrawal', default: null },
    withdrawalStatus: { type: String, enum: WITHDRAWAL_STATUS, default: 'not_required' },
    isInterBranch: { type: Boolean, default: false },
    isInterWarehouse: { type: Boolean, default: false },

    // ============ Below-price approval ============
    priceApprovalId: { type: mongoose.Schema.Types.ObjectId, ref: 'PriceApproval', default: null },
    hasBelowPriceItems: { type: Boolean, default: false },

    // ============ Status ============
    status: { type: String, enum: RECEIPT_STATUS, default: 'draft' },

    // ============ WhatsApp ============
    whatsapp: {
        sent: { type: Boolean, default: false },
        sentAt: { type: Date, default: null },
        messageId: { type: String, default: null },
        error: { type: String, default: null }
    },

    // ============ Refund ============
    refund: {
        refundedAt: Date,
        refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: String,
        refundAmount: Number,
        itemsRefunded: [{
            item: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
            quantity: Number,
            refundAmount: Number
        }]
    },

    // ============ Cancellation ============
    cancellation: {
        cancelledAt: Date,
        cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: String
    },

    // ============ Security ============
    securityHash: {
        type: String,
        required: true
        // SHA256 of critical fields — for tamper detection
    },

    // ============ Metadata ============
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ============================================================
// Indexes
// ============================================================
receiptSchema.index({ company: 1, branch: 1, createdAt: -1 });
receiptSchema.index({ company: 1, paymentStatus: 1, createdAt: -1 });
receiptSchema.index({ company: 1, status: 1, createdAt: -1 });
receiptSchema.index({ soldBy: 1, createdAt: -1 });
receiptSchema.index({ withdrawalRequest: 1 });
receiptSchema.index({ 'customer.phone': 1 });

// ============================================================
// Pre-validate: generate receiptId + security hash
// ============================================================
receiptSchema.pre('validate', function (next) {
    if (!this.receiptId) {
        const date = new Date();
        const ymd = date.getFullYear().toString().slice(-2) +
                    String(date.getMonth() + 1).padStart(2, '0') +
                    String(date.getDate()).padStart(2, '0');
        const rand = Math.floor(1000 + Math.random() * 9000);
        this.receiptId = `RCP-${ymd}-${rand}`;
    }

    // Calculate totals
    this.subtotal = this.items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
    this.totalDiscount = this.items.reduce((s, i) => s + (i.discount || 0), 0);
    this.totalTax = this.items.reduce((s, i) => s + (i.tax || 0), 0);
    this.totalAmount = this.subtotal - this.totalDiscount + this.totalTax;
    this.totalCost = this.items.reduce((s, i) => s + (i.quantity * i.unitCost), 0);
    this.totalProfit = this.totalAmount - this.totalCost;

    // Security hash
    const payload = {
        receiptId: this.receiptId,
        items: this.items.map(i => ({ id: i.inventoryItem, qty: i.quantity, price: i.unitPrice })),
        totalAmount: this.totalAmount,
        soldBy: this.soldBy,
        createdAt: this.createdAt
    };
    this.securityHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Method: cashier confirms payment
// ============================================================
receiptSchema.methods.confirmPayment = function (user, notes = '') {
    if (this.paymentStatus === 'confirmed') {
        throw new Error('Payment already confirmed');
    }
    if (this.paymentStatus === 'disputed') {
        throw new Error('Payment under dispute — cannot confirm');
    }
    this.paymentStatus = 'confirmed';
    this.cashierConfirmation.confirmedBy = user._id;
    this.cashierConfirmation.confirmedByName = `${user.firstName} ${user.lastName}`;
    this.cashierConfirmation.confirmedAt = new Date();
    this.cashierConfirmation.notes = notes;
};

// ============================================================
// Method: cashier disputes payment
// ============================================================
receiptSchema.methods.disputePayment = function (user, reason) {
    if (this.paymentStatus === 'confirmed') {
        throw new Error('Payment already confirmed — cannot dispute');
    }
    this.paymentStatus = 'disputed';
    this.cashierConfirmation.disputedBy = user._id;
    this.cashierConfirmation.disputedAt = new Date();
    this.cashierConfirmation.disputeReason = reason;
};

// ============================================================
// Method: role-aware serialization
// ============================================================
receiptSchema.methods.toPublicJSON = function (viewerRole = 'sales') {
    const base = {
        id: this._id,
        receiptId: this.receiptId,
        status: this.status,
        paymentStatus: this.paymentStatus,
        paymentMethod: this.paymentMethod,
        subtotal: this.subtotal,
        totalDiscount: this.totalDiscount,
        totalTax: this.totalTax,
        totalAmount: this.totalAmount,
        customer: this.customer,
        soldBy: this.soldBy,
        soldByName: this.soldByName,
        storeLocation: this.storeLocation,
        withdrawalRequest: this.withdrawalRequest,
        withdrawalStatus: this.withdrawalStatus,
        isInterBranch: this.isInterBranch,
        isInterWarehouse: this.isInterWarehouse,
        hasBelowPriceItems: this.hasBelowPriceItems,
        whatsapp: this.whatsapp,
        createdAt: this.createdAt,
        items: this.items.map(i => ({
            itemCode: i.itemCode,
            itemName: i.itemName,
            quantity: i.quantity,
            unit: i.unit,
            unitPrice: i.unitPrice,
            totalPrice: i.totalPrice,
            discount: i.discount,
            tax: i.tax
            // NOTE: no unitCost, no originWarehouse in default view
        })),
        cashierConfirmation: {
            confirmedAt: this.cashierConfirmation.confirmedAt,
            confirmedByName: this.cashierConfirmation.confirmedByName,
            disputedAt: this.cashierConfirmation.disputedAt
        }
    };

    // Privileged roles see cost, profit, origin warehouse
    if (['employer', 'manager'].includes(viewerRole)) {
        base.totalCost = this.totalCost;
        base.totalProfit = this.totalProfit;
        base.items = this.items.map(i => ({
            ...i.toObject(),
            originWarehouseName: i.originWarehouseName
        }));
    }

    // Main stock sees cost
    if (viewerRole === 'stock_main') {
        base.totalCost = this.totalCost;
    }

    // Cashier NEVER sees profit (explicitly strip)
    if (viewerRole === 'cashier') {
        delete base.totalCost;
        delete base.totalProfit;
    }

    return base;
};

receiptSchema.set('toJSON', { virtuals: true });
receiptSchema.set('toObject', { virtuals: true });

receiptSchema.statics.PAYMENT_STATUS = PAYMENT_STATUS;
receiptSchema.statics.PAYMENT_METHODS = PAYMENT_METHODS;
receiptSchema.statics.RECEIPT_STATUS = RECEIPT_STATUS;

module.exports = mongoose.model('Receipt', receiptSchema);