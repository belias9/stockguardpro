/**
 * PriceApproval Model
 * Request to sell below listed price (or with an above-threshold discount).
 * Requires manager or employer approval.
 */
const mongoose = require('mongoose');

const STATUS = ['pending', 'approved', 'rejected', 'expired'];
const APPROVAL_TYPE = ['below_price', 'large_discount'];

const priceApprovalSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },

    // ============ Identity ============
    approvalId: { type: String, unique: true, required: true },  // PA-YYMMDD-XXXX

    // ============ Type ============
    type: { type: String, enum: APPROVAL_TYPE, required: true, default: 'below_price' },

    // ============ Requester ============
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedByName: { type: String, required: true },

    // ============ Item ============
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    itemCode: { type: String, required: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unit: { type: String, default: 'pieces' },

    // ============ Pricing ============
    listedPrice: { type: Number, required: true, min: 0 },
    proposedPrice: { type: Number, required: true, min: 0 },
    difference: { type: Number, required: true },  // proposedPrice - listedPrice (negative = below)
    discountPercentage: { type: Number, default: 0 },

    // ============ Reason ============
    reason: { type: String, required: true, maxlength: 500 },

    // ============ Status ============
    status: { type: String, enum: STATUS, default: 'pending', index: true },

    // ============ Approval ============
    approval: {
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        approvedByName: { type: String, default: null },
        approvedAt: { type: Date, default: null },
        comments: { type: String, default: '' },
        rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        rejectedByName: { type: String, default: null },
        rejectedAt: { type: Date, default: null },
        rejectionReason: { type: String, default: null }
    },

    // ============ Link to receipt ============
    receipt: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', default: null },

    // ============ Expiry (auto-reject stale requests) ============
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    },

    // ============ Metadata ============
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ============================================================
// Indexes
// ============================================================
priceApprovalSchema.index({ company: 1, status: 1, createdAt: -1 });
priceApprovalSchema.index({ branch: 1, status: 1 });
priceApprovalSchema.index({ requestedBy: 1, createdAt: -1 });
priceApprovalSchema.index({ expiresAt: 1, status: 1 });

// ============================================================
// Pre-validate: generate ID + calculate difference
// ============================================================
priceApprovalSchema.pre('validate', function (next) {
    if (!this.approvalId) {
        const date = new Date();
        const ymd = date.getFullYear().toString().slice(-2) +
                    String(date.getMonth() + 1).padStart(2, '0') +
                    String(date.getDate()).padStart(2, '0');
        const rand = Math.floor(1000 + Math.random() * 9000);
        this.approvalId = `PA-${ymd}-${rand}`;
    }

    // Calculate difference
    this.difference = this.proposedPrice - this.listedPrice;
    this.discountPercentage = this.listedPrice > 0
        ? ((this.listedPrice - this.proposedPrice) / this.listedPrice) * 100
        : 0;

    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Methods
// ============================================================
priceApprovalSchema.methods.approve = function (user, comments = '') {
    if (this.status !== 'pending') throw new Error(`Cannot approve a ${this.status} approval`);
    this.status = 'approved';
    this.approval.approvedBy = user._id;
    this.approval.approvedByName = `${user.firstName} ${user.lastName}`;
    this.approval.approvedAt = new Date();
    this.approval.comments = comments;
};

priceApprovalSchema.methods.reject = function (user, reason) {
    if (this.status !== 'pending') throw new Error(`Cannot reject a ${this.status} approval`);
    this.status = 'rejected';
    this.approval.rejectedBy = user._id;
    this.approval.rejectedByName = `${user.firstName} ${user.lastName}`;
    this.approval.rejectedAt = new Date();
    this.approval.rejectionReason = reason;
};

priceApprovalSchema.methods.expire = function () {
    if (this.status !== 'pending') return;
    this.status = 'expired';
};

// ============================================================
// Serialization
// ============================================================
priceApprovalSchema.methods.toPublicJSON = function () {
    return {
        id: this._id,
        approvalId: this.approvalId,
        type: this.type,
        status: this.status,
        requestedBy: this.requestedBy,
        requestedByName: this.requestedByName,
        itemCode: this.itemCode,
        itemName: this.itemName,
        quantity: this.quantity,
        unit: this.unit,
        listedPrice: this.listedPrice,
        proposedPrice: this.proposedPrice,
        difference: this.difference,
        discountPercentage: this.discountPercentage,
        reason: this.reason,
        approval: this.approval,
        receipt: this.receipt,
        expiresAt: this.expiresAt,
        createdAt: this.createdAt
    };
};

priceApprovalSchema.set('toJSON', { virtuals: true });
priceApprovalSchema.set('toObject', { virtuals: true });

priceApprovalSchema.statics.STATUS = STATUS;
priceApprovalSchema.statics.APPROVAL_TYPE = APPROVAL_TYPE;

module.exports = mongoose.model('PriceApproval', priceApprovalSchema);