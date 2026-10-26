/**
 * Withdrawal Model
 * Stock transfer request (store-to-warehouse, warehouse-to-warehouse, branch-to-branch).
 * Requires Manager approval only. Stock personnel confirm dispatch/receipt.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');

const WITHDRAWAL_STATUS = [
    'pending',
    'approved',
    'rejected',
    'in_transit',
    'completed',
    'cancelled'
];

const TRANSFER_TYPES = ['store_to_warehouse', 'warehouse_to_warehouse', 'branch_to_branch'];

const withdrawalSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    sourceBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    sourceWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    destinationBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    destinationWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },

    // ============ Identity ============
    withdrawalId: { type: String, unique: true, required: true },  // WD-YYMMDD-XXXX
    transferType: { type: String, enum: TRANSFER_TYPES, required: true },
    isInterBranch: { type: Boolean, default: false },

    // ============ Requester ============
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requesterName: { type: String, required: true },
    requesterRole: { type: String, required: true },

    // ============ Items ============
    items: [{
        inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
        itemCode: { type: String, required: true },
        itemName: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unit: { type: String, required: true },
        unitCost: { type: Number, required: true, min: 0 },
        totalCost: { type: Number, required: true, min: 0 }
    }],
    totalItems: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0, min: 0 },

    // ============ Status ============
    status: { type: String, enum: WITHDRAWAL_STATUS, default: 'pending', index: true },

    // ============ Approval (Manager only) ============
    approval: {
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        approvedByName: { type: String, default: null },
        approvedAt: { type: Date, default: null },
        comments: { type: String, default: '' }
    },

    // ============ Rejection ============
    rejection: {
        rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        rejectedByName: { type: String, default: null },
        rejectedAt: { type: Date, default: null },
        reason: { type: String, default: null }
    },

    // ============ Dispatch (Stock personnel) ============
    dispatch: {
        confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        confirmedByName: { type: String, default: null },
        confirmedAt: { type: Date, default: null },
        collectorName: { type: String, default: null },
        collectorEmployeeId: { type: String, default: null },
        collectorPhone: { type: String, default: null },
        method: { type: String, enum: ['password', 'otp', 'digital_signature'], default: 'password' }
    },

    // ============ Receipt (destination stock) ============
    receive: {
        confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        confirmedByName: { type: String, default: null },
        confirmedAt: { type: Date, default: null }
    },

    // ============ Receipt reference ============
    receiptReference: {
        receiptId: String,
        customerName: String,
        customerPhone: String
    },

    // ============ Priority + notes ============
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    notes: {
        requesterNotes: { type: String, default: '' },
        approverNotes: { type: String, default: '' },
        dispatchNotes: { type: String, default: '' }
    },

    // ============ Tracking ============
    tracking: {
        requestedAt: { type: Date, default: Date.now },
        approvedAt: Date,
        dispatchedAt: Date,
        receivedAt: Date,
        completedAt: Date
    },

    // ============ Security ============
    securityHash: { type: String, required: true },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },

    // ============ Metadata ============
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ============================================================
// Indexes
// ============================================================
withdrawalSchema.index({ company: 1, status: 1, createdAt: -1 });
withdrawalSchema.index({ sourceBranch: 1, status: 1 });
withdrawalSchema.index({ destinationBranch: 1, status: 1 });
withdrawalSchema.index({ requestedBy: 1, createdAt: -1 });

// ============================================================
// Pre-validate: generate ID + hash + totals
// ============================================================
withdrawalSchema.pre('validate', function (next) {
    if (!this.withdrawalId) {
        const date = new Date();
        const ymd = date.getFullYear().toString().slice(-2) +
                    String(date.getMonth() + 1).padStart(2, '0') +
                    String(date.getDate()).padStart(2, '0');
        const rand = Math.floor(1000 + Math.random() * 9000);
        this.withdrawalId = `WD-${ymd}-${rand}`;
    }

    this.totalItems = this.items.reduce((s, i) => s + i.quantity, 0);
    this.totalCost = this.items.reduce((s, i) => s + (i.totalCost || 0), 0);
    this.isInterBranch = !this.sourceBranch.equals(this.destinationBranch);

    const payload = {
        withdrawalId: this.withdrawalId,
        items: this.items.map(i => ({ id: i.inventoryItem, qty: i.quantity })),
        sourceWarehouse: this.sourceWarehouse,
        destinationWarehouse: this.destinationWarehouse,
        requestedBy: this.requestedBy
    };
    this.securityHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    this.updatedAt = Date.now();
    next();
});

// ============================================================
// State transition methods
// ============================================================
withdrawalSchema.methods.approve = function (user, comments = '') {
    if (this.status !== 'pending') throw new Error(`Cannot approve a ${this.status} withdrawal`);
    this.status = 'approved';
    this.approval = {
        approvedBy: user._id,
        approvedByName: `${user.firstName} ${user.lastName}`,
        approvedAt: new Date(),
        comments
    };
    this.tracking.approvedAt = new Date();
};

withdrawalSchema.methods.reject = function (user, reason) {
    if (this.status !== 'pending') throw new Error(`Cannot reject a ${this.status} withdrawal`);
    this.status = 'rejected';
    this.rejection = {
        rejectedBy: user._id,
        rejectedByName: `${user.firstName} ${user.lastName}`,
        rejectedAt: new Date(),
        reason
    };
};

withdrawalSchema.methods.dispatchStock = function (user, { collectorName, collectorEmployeeId, collectorPhone, method = 'password' }) {
    if (this.status !== 'approved') throw new Error(`Cannot dispatch a ${this.status} withdrawal`);
    this.status = 'in_transit';
    this.dispatch = {
        confirmedBy: user._id,
        confirmedByName: `${user.firstName} ${user.lastName}`,
        confirmedAt: new Date(),
        collectorName,
        collectorEmployeeId,
        collectorPhone,
        method
    };
    this.tracking.dispatchedAt = new Date();
};

withdrawalSchema.methods.receiveStock = function (user) {
    if (this.status !== 'in_transit') throw new Error(`Cannot receive a ${this.status} withdrawal`);
    this.status = 'completed';
    this.receive = {
        confirmedBy: user._id,
        confirmedByName: `${user.firstName} ${user.lastName}`,
        confirmedAt: new Date()
    };
    this.tracking.receivedAt = new Date();
    this.tracking.completedAt = new Date();
};

// ============================================================
// Role-aware serialization
// ============================================================
withdrawalSchema.methods.toPublicJSON = function (viewerRole = 'sales') {
    const base = {
        id: this._id,
        withdrawalId: this.withdrawalId,
        transferType: this.transferType,
        isInterBranch: this.isInterBranch,
        status: this.status,
        requestedBy: this.requestedBy,
        requesterName: this.requesterName,
        requesterRole: this.requesterRole,
        sourceBranch: this.sourceBranch,
        sourceWarehouse: this.sourceWarehouse,
        destinationBranch: this.destinationBranch,
        destinationWarehouse: this.destinationWarehouse,
        totalItems: this.totalItems,
        priority: this.priority,
        approval: this.approval,
        dispatch: this.dispatch,
        receive: this.receive,
        receiptReference: this.receiptReference,
        tracking: this.tracking,
        createdAt: this.createdAt,
        items: this.items.map(i => ({
            itemCode: i.itemCode,
            itemName: i.itemName,
            quantity: i.quantity,
            unit: i.unit
        }))
    };

    if (['employer', 'manager'].includes(viewerRole)) {
        base.totalCost = this.totalCost;
        base.items = this.items;
        base.notes = this.notes;
    }

    if (viewerRole === 'stock_main') {
        base.items = this.items;
        base.notes = this.notes;
    }

    return base;
};

withdrawalSchema.set('toJSON', { virtuals: true });
withdrawalSchema.set('toObject', { virtuals: true });

withdrawalSchema.statics.WITHDRAWAL_STATUS = WITHDRAWAL_STATUS;
withdrawalSchema.statics.TRANSFER_TYPES = TRANSFER_TYPES;

module.exports = mongoose.model('Withdrawal', withdrawalSchema);