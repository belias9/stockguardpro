/**
 * CustomerOrder Model
 * An order placed by a customer via WhatsApp or in-app.
 * Can be created automatically (system) or manually (sales person).
 */
const mongoose = require('mongoose');

const STATUS = ['pending', 'approved', 'rejected', 'fulfilled', 'cancelled'];
const CHANNELS = ['whatsapp', 'in_app', 'manual'];

const customerOrderSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },

    // ============ Identity ============
    orderId: { type: String, unique: true, required: true },  // CO-YYMMDD-XXXX

    // ============ Customer ============
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },

    // ============ Source ============
    channel: { type: String, enum: CHANNELS, default: 'whatsapp' },
    originalMessage: { type: String, default: '' },

    // ============ Items ============
    items: [{
        inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', default: null },
        itemCode: { type: String, default: '' },
        itemName: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0.01 },
        unit: { type: String, default: 'pieces' },
        unitPrice: { type: Number, default: 0, min: 0 },
        totalPrice: { type: Number, default: 0, min: 0 },
        inStock: { type: Boolean, default: true }
    }],
    totalItems: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },

    // ============ Status ============
    status: { type: String, enum: STATUS, default: 'pending', index: true },

    // ============ Approval ============
    approval: {
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        approvedByName: { type: String, default: null },
        approvedAt: { type: Date, default: null },
        rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        rejectedByName: { type: String, default: null },
        rejectedAt: { type: Date, default: null },
        rejectionReason: { type: String, default: null }
    },

    // ============ Fulfillment ============
    fulfillment: {
        fulfilledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        fulfilledByName: { type: String, default: null },
        fulfilledAt: { type: Date, default: null },
        receiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', default: null }
    },

    // ============ Conversation ============
    conversationLog: [{
        message: String,
        direction: { type: String, enum: ['incoming', 'outgoing'] },
        handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        handledByName: String,
        automated: { type: Boolean, default: false },
        timestamp: { type: Date, default: Date.now }
    }],

    // ============ Escalation ============
    escalated: { type: Boolean, default: false },
    escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    escalatedAt: { type: Date, default: null },

    // ============ Notes ============
    notes: { type: String, default: '' },

    // ============ Metadata ============
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ============================================================
// Indexes
// ============================================================
customerOrderSchema.index({ company: 1, status: 1, createdAt: -1 });
customerOrderSchema.index({ branch: 1, status: 1 });
customerOrderSchema.index({ customer: 1, createdAt: -1 });
customerOrderSchema.index({ customerPhone: 1 });

// ============================================================
// Pre-validate: generate ID + totals
// ============================================================
customerOrderSchema.pre('validate', function (next) {
    if (!this.orderId) {
        const date = new Date();
        const ymd = date.getFullYear().toString().slice(-2) +
                    String(date.getMonth() + 1).padStart(2, '0') +
                    String(date.getDate()).padStart(2, '0');
        const rand = Math.floor(1000 + Math.random() * 9000);
        this.orderId = `CO-${ymd}-${rand}`;
    }

    this.totalItems = this.items.reduce((s, i) => s + (i.quantity || 0), 0);
    this.totalAmount = this.items.reduce((s, i) => s + (i.totalPrice || 0), 0);

    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Methods
// ============================================================
customerOrderSchema.methods.approve = function (user) {
    if (this.status !== 'pending') throw new Error(`Cannot approve a ${this.status} order`);
    this.status = 'approved';
    this.approval.approvedBy = user._id;
    this.approval.approvedByName = `${user.firstName} ${user.lastName}`;
    this.approval.approvedAt = new Date();
};

customerOrderSchema.methods.reject = function (user, reason) {
    if (this.status !== 'pending') throw new Error(`Cannot reject a ${this.status} order`);
    this.status = 'rejected';
    this.approval.rejectedBy = user._id;
    this.approval.rejectedByName = `${user.firstName} ${user.lastName}`;
    this.approval.rejectedAt = new Date();
    this.approval.rejectionReason = reason;
};

customerOrderSchema.methods.fulfill = function (user, receiptId) {
    if (this.status !== 'approved') throw new Error(`Cannot fulfill a ${this.status} order`);
    this.status = 'fulfilled';
    this.fulfillment.fulfilledBy = user._id;
    this.fulfillment.fulfilledByName = `${user.firstName} ${user.lastName}`;
    this.fulfillment.fulfilledAt = new Date();
    this.fulfillment.receiptId = receiptId;
};

customerOrderSchema.methods.escalate = function (user) {
    this.escalated = true;
    this.escalatedTo = user._id;
    this.escalatedAt = new Date();
};

customerOrderSchema.methods.addConversation = function (entry) {
    this.conversationLog.push({
        message: entry.message,
        direction: entry.direction,
        handledBy: entry.handledBy || null,
        handledByName: entry.handledByName || null,
        automated: entry.automated || false,
        timestamp: new Date()
    });
};

// ============================================================
// Serialization
// ============================================================
customerOrderSchema.methods.toPublicJSON = function () {
    return {
        id: this._id,
        orderId: this.orderId,
        customer: this.customer,
        customerName: this.customerName,
        customerPhone: this.customerPhone,
        channel: this.channel,
        status: this.status,
        items: this.items,
        totalItems: this.totalItems,
        totalAmount: this.totalAmount,
        approval: this.approval,
        fulfillment: this.fulfillment,
        escalated: this.escalated,
        notes: this.notes,
        createdAt: this.createdAt
    };
};

customerOrderSchema.set('toJSON', { virtuals: true });
customerOrderSchema.set('toObject', { virtuals: true });

customerOrderSchema.statics.STATUS = STATUS;
customerOrderSchema.statics.CHANNELS = CHANNELS;

module.exports = mongoose.model('CustomerOrder', customerOrderSchema);