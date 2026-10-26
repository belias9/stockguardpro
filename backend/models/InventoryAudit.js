/**
 * InventoryAudit Model
 * One session of inventory mode (blind count).
 * Blurs stock → stock counts physically → employer/manager approves.
 */
const mongoose = require('mongoose');

const STATUS = ['in_progress', 'completed', 'cancelled'];

const inventoryAuditSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },

    // ============ Identity ============
    auditId: { type: String, unique: true, required: true },  // IA-YYMMDD-XXXX

    // ============ Started by ============
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startedByName: { type: String, required: true },
    startedAt: { type: Date, default: Date.now },

    // ============ Status ============
    status: { type: String, enum: STATUS, default: 'in_progress', index: true },

    // ============ Items in audit ============
    items: [{
        inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
        itemCode: { type: String, required: true },
        itemName: { type: String, required: true },
        unit: { type: String, required: true },
        systemQuantity: { type: Number, required: true, min: 0 },  // at start
        actualCount: { type: Number, default: null, min: 0 },      // physical
        surplusOrLacking: { type: Number, default: null },         // actualCount - systemQuantity
        countedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        countedAt: { type: Date, default: null }
    }],

    // ============ Zero-stock sales during audit ============
    zeroStockSales: [{
        inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
        itemCode: String,
        itemName: String,
        quantity: { type: Number, required: true, min: 0.01 },
        receiptId: { type: String, default: null },
        recordedAt: { type: Date, default: Date.now },
        autoDeducted: { type: Boolean, default: false }
    }],

    // ============ Completion ============
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedByName: { type: String, default: null },
    completedAt: { type: Date, default: null },

    // ============ Financial summary ============
    summary: {
        totalItems: { type: Number, default: 0 },
        totalSurplus: { type: Number, default: 0 },
        totalLacking: { type: Number, default: 0 },
        surplusValue: { type: Number, default: 0 },
        lackingValue: { type: Number, default: 0 },
        zeroStockSalesCount: { type: Number, default: 0 },
        zeroStockSalesValue: { type: Number, default: 0 }
    },

    // ============ Notes ============
    notes: { type: String, default: '' },

    // ============ Metadata ============
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ============================================================
// Indexes
// ============================================================
inventoryAuditSchema.index({ company: 1, status: 1 });
inventoryAuditSchema.index({ branch: 1, status: 1 });
inventoryAuditSchema.index({ warehouse: 1, status: 1 });
inventoryAuditSchema.index({ startedAt: -1 });

// ============================================================
// Pre-validate: generate ID
// ============================================================
inventoryAuditSchema.pre('validate', function (next) {
    if (!this.auditId) {
        const date = new Date();
        const ymd = date.getFullYear().toString().slice(-2) +
                    String(date.getMonth() + 1).padStart(2, '0') +
                    String(date.getDate()).padStart(2, '0');
        const rand = Math.floor(1000 + Math.random() * 9000);
        this.auditId = `IA-${ymd}-${rand}`;
    }
    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Methods
// ============================================================
inventoryAuditSchema.methods.recordCount = function (inventoryItemId, actualCount, user) {
    if (this.status !== 'in_progress') throw new Error('Audit is not in progress');

    const item = this.items.find(i => i.inventoryItem.toString() === inventoryItemId.toString());
    if (!item) throw new Error('Item not part of this audit');

    item.actualCount = actualCount;
    item.surplusOrLacking = actualCount - item.systemQuantity;
    item.countedBy = user._id;
    item.countedAt = new Date();

    this.recalculateSummary();
};

inventoryAuditSchema.methods.recalculateSummary = function () {
    const counted = this.items.filter(i => i.actualCount !== null);
    this.summary.totalItems = counted.length;
    this.summary.totalSurplus = counted
        .filter(i => i.surplusOrLacking > 0)
        .reduce((s, i) => s + i.surplusOrLacking, 0);
    this.summary.totalLacking = counted
        .filter(i => i.surplusOrLacking < 0)
        .reduce((s, i) => s + Math.abs(i.surplusOrLacking), 0);
};

inventoryAuditSchema.methods.recordZeroStockSale = function ({ inventoryItem, itemCode, itemName, quantity, receiptId }) {
    this.zeroStockSales.push({
        inventoryItem,
        itemCode,
        itemName,
        quantity,
        receiptId,
        recordedAt: new Date(),
        autoDeducted: false
    });
    this.summary.zeroStockSalesCount = this.zeroStockSales.length;
};

inventoryAuditSchema.methods.complete = function (user) {
    if (this.status !== 'in_progress') throw new Error(`Cannot complete a ${this.status} audit`);
    this.status = 'completed';
    this.completedBy = user._id;
    this.completedByName = `${user.firstName} ${user.lastName}`;
    this.completedAt = new Date();
};

inventoryAuditSchema.methods.cancel = function () {
    if (this.status !== 'in_progress') throw new Error(`Cannot cancel a ${this.status} audit`);
    this.status = 'cancelled';
};

// ============================================================
// Serialization — actual count only visible to employer/manager
// ============================================================
inventoryAuditSchema.methods.toPublicJSON = function (viewerRole = 'stock') {
    const base = {
        id: this._id,
        auditId: this.auditId,
        status: this.status,
        startedBy: this.startedBy,
        startedByName: this.startedByName,
        startedAt: this.startedAt,
        completedAt: this.completedAt,
        warehouse: this.warehouse,
        branch: this.branch,
        summary: this.summary,
        createdAt: this.createdAt
    };

    // Only employer and manager see actual counts
    if (['employer', 'manager'].includes(viewerRole)) {
        base.items = this.items;
        base.zeroStockSales = this.zeroStockSales;
    } else {
        // Stock user sees items but no actual count or surplus
        base.items = this.items.map(i => ({
            itemCode: i.itemCode,
            itemName: i.itemName,
            unit: i.unit,
            countedAt: i.countedAt
            // NO actualCount, NO surplusOrLacking, NO systemQuantity
        }));
    }

    return base;
};

inventoryAuditSchema.set('toJSON', { virtuals: true });
inventoryAuditSchema.set('toObject', { virtuals: true });

inventoryAuditSchema.statics.STATUS = STATUS;

module.exports = mongoose.model('InventoryAudit', inventoryAuditSchema);