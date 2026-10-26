/**
 * PreRecord Model
 * Shop buyer's purchase record — enters stock only after stock personnel confirms.
 */
const mongoose = require('mongoose');

const STATUS = ['pending', 'confirmed', 'rejected', 'cancelled'];

const preRecordSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    // Warehouse where items will be added after confirmation
    // Can differ from buyer's branch (buy for another branch)

    // ============ Identity ============
    preRecordId: { type: String, unique: true, required: true },  // PR-YYMMDD-XXXX

    // ============ Buyer ============
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyerName: { type: String, required: true },

    // ============ Items purchased ============
    items: [{
        itemCode: { type: String, required: true },
        itemName: { type: String, required: true },
        category: { type: String, required: true },
        unit: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0.01 },
        unitCost: { type: Number, required: true, min: 0 },
        sellingPrice: { type: Number, default: 0, min: 0 },
        totalCost: { type: Number, required: true, min: 0 },
        // Image attaches to LAST item only
        imageUrl: { type: String, default: null }
    }],
    totalItems: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0, min: 0 },

    // ============ Receipt image (must be on last item) ============
    receiptImageUrl: { type: String, required: [true, 'Receipt image is required'] },
    receiptImageNotes: { type: String, default: '' },

    // ============ Supplier ============
    supplier: {
        name: { type: String, default: '' },
        contact: { type: String, default: '' },
        address: { type: String, default: '' }
    },

    // ============ Status ============
    status: { type: String, enum: STATUS, default: 'pending', index: true },

    // ============ Confirmation (by stock personnel) ============
    confirmation: {
        confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        confirmedByName: { type: String, default: null },
        confirmedAt: { type: Date, default: null },
        notes: { type: String, default: '' },
        rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        rejectedByName: { type: String, default: null },
        rejectedAt: { type: Date, default: null },
        rejectionReason: { type: String, default: null }
    },

    // ============ Purchase date ============
    purchaseDate: { type: Date, default: Date.now },
    notes: { type: String, default: '' },

    // ============ Metadata ============
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ============================================================
// Indexes
// ============================================================
preRecordSchema.index({ company: 1, status: 1, createdAt: -1 });
preRecordSchema.index({ branch: 1, status: 1 });
preRecordSchema.index({ buyer: 1, createdAt: -1 });
preRecordSchema.index({ warehouse: 1, status: 1 });

// ============================================================
// Pre-validate: generate ID + totals + validate last item has image
// ============================================================
preRecordSchema.pre('validate', function (next) {
    if (!this.preRecordId) {
        const date = new Date();
        const ymd = date.getFullYear().toString().slice(-2) +
                    String(date.getMonth() + 1).padStart(2, '0') +
                    String(date.getDate()).padStart(2, '0');
        const rand = Math.floor(1000 + Math.random() * 9000);
        this.preRecordId = `PR-${ymd}-${rand}`;
    }

    // Calculate totals
    this.totalItems = this.items.reduce((s, i) => s + (i.quantity || 0), 0);
    this.totalCost = this.items.reduce((s, i) => s + (i.totalCost || 0), 0);

    // Validate: last item must have image
    if (this.items.length > 0) {
        const lastItem = this.items[this.items.length - 1];
        if (!lastItem.imageUrl && !this.receiptImageUrl) {
            return next(new Error('Last item must have an image OR receiptImageUrl must be set'));
        }
    }

    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Methods
// ============================================================
preRecordSchema.methods.confirm = function (user, notes = '') {
    if (this.status !== 'pending') throw new Error(`Cannot confirm a ${this.status} pre-record`);
    this.status = 'confirmed';
    this.confirmation.confirmedBy = user._id;
    this.confirmation.confirmedByName = `${user.firstName} ${user.lastName}`;
    this.confirmation.confirmedAt = new Date();
    this.confirmation.notes = notes;
};

preRecordSchema.methods.reject = function (user, reason) {
    if (this.status !== 'pending') throw new Error(`Cannot reject a ${this.status} pre-record`);
    this.status = 'rejected';
    this.confirmation.rejectedBy = user._id;
    this.confirmation.rejectedByName = `${user.firstName} ${user.lastName}`;
    this.confirmation.rejectedAt = new Date();
    this.confirmation.rejectionReason = reason;
};

preRecordSchema.methods.cancel = function () {
    if (this.status !== 'pending') throw new Error(`Cannot cancel a ${this.status} pre-record`);
    this.status = 'cancelled';
};

// ============================================================
// Role-aware serialization
// ============================================================
preRecordSchema.methods.toPublicJSON = function (viewerRole = 'shop_buyer') {
    const base = {
        id: this._id,
        preRecordId: this.preRecordId,
        status: this.status,
        buyer: this.buyer,
        buyerName: this.buyerName,
        warehouse: this.warehouse,
        branch: this.branch,
        items: this.items.map(i => ({
            itemCode: i.itemCode,
            itemName: i.itemName,
            category: i.category,
            unit: i.unit,
            quantity: i.quantity,
            sellingPrice: i.sellingPrice,
            totalCost: i.totalCost,
            imageUrl: i.imageUrl
        })),
        totalItems: this.totalItems,
        receiptImageUrl: this.receiptImageUrl,
        supplier: this.supplier,
        confirmation: this.confirmation,
        purchaseDate: this.purchaseDate,
        createdAt: this.createdAt
    };

    // Cost visible to employer, manager, stock
    if (['employer', 'manager', 'stock_main'].includes(viewerRole)) {
        base.items = this.items;
        base.totalCost = this.totalCost;
    }

    return base;
};

preRecordSchema.set('toJSON', { virtuals: true });
preRecordSchema.set('toObject', { virtuals: true });

preRecordSchema.statics.STATUS = STATUS;

module.exports = mongoose.model('PreRecord', preRecordSchema);