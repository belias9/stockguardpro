/**
 * Inventory Model
 * Stock for one item in ONE specific warehouse.
 * Same item code can exist in multiple warehouses with different quantities.
 */
const mongoose = require('mongoose');

// ============================================================
// Constants
// ============================================================
const DEFAULT_CATEGORIES = [
    'electronics',
    'clothing',
    'food',
    'furniture',
    'tools',
    'raw_materials',
    'finished_goods',
    'other'
];

const DEFAULT_UNITS = [
    'pieces',
    'kg',
    'liters',
    'meters',
    'boxes',
    'cartons',
    'bags',
    'dozens'
];

const MOVEMENT_TYPES = ['in', 'out', 'adjustment', 'transfer', 'return'];

// ============================================================
// Movement subdocument (immutable append-only)
// ============================================================
const movementSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: MOVEMENT_TYPES,
        required: true
    },
    quantity: {
        type: Number,
        required: true
        // Positive for in/return/transfer-in, negative for out/transfer-out
    },
    previousQuantity: {
        type: Number,
        required: true
    },
    newQuantity: {
        type: Number,
        required: true,
        min: 0
    },
    reference: {
        type: String,
        default: null
        // e.g., "RCP-241024-0421", "WD-241024-0788"
    },
    reason: {
        type: String,
        default: ''
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    performedByName: {
        type: String,
        default: ''
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { _id: false }); // No separate _id for each movement

// ============================================================
// Main inventory schema
// ============================================================
const inventorySchema = new mongoose.Schema({
    // ============ Tenant ============
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: [true, 'Company is required'],
        index: true
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: [true, 'Branch is required'],
        index: true
        // Denormalized from warehouse for faster queries
        // Warehouse.branch must match this — validated in pre-save
    },
    warehouse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: [true, 'Warehouse is required'],
        index: true
    },

    // ============ Identity ============
    itemCode: {
        type: String,
        required: [true, 'Item code is required'],
        trim: true,
        uppercase: true,
        maxlength: [50, 'Item code cannot exceed 50 characters']
        // Unique per warehouse (compound index)
    },
    name: {
        type: String,
        required: [true, 'Item name is required'],
        trim: true,
        maxlength: [200, 'Item name cannot exceed 200 characters']
    },
    description: {
        type: String,
        default: '',
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },

    // ============ Classification ============
    category: {
        type: String,
        required: [true, 'Category is required'],
        trim: true,
        lowercase: true
        // Can be a default category OR a custom category defined by employer
        // Validation happens at service layer (checks company.customCategories)
    },
    unit: {
        type: String,
        required: [true, 'Unit is required'],
        trim: true,
        lowercase: true
        // Can be a default unit OR a custom unit defined by employer
        // Validation happens at service layer
    },

    // ============ Stock levels ============
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        default: 0,
        min: [0, 'Quantity cannot be negative'],
        validate: {
            validator: Number.isFinite,
            message: 'Quantity must be a valid number'
        }
    },
    minStockLevel: {
        type: Number,
        default: 10,
        min: [0, 'Min stock level cannot be negative']
    },
    reorderPoint: {
        type: Number,
        default: 20,
        min: [0, 'Reorder point cannot be negative']
    },
    maxStockLevel: {
        type: Number,
        default: 1000,
        min: [0, 'Max stock level cannot be negative']
    },

    // ============ Pricing ============
    unitCost: {
        type: Number,
        required: [true, 'Unit cost is required'],
        min: [0, 'Unit cost cannot be negative']
        // Visible only to employer, manager, main stock personnel
    },
    sellingPrice: {
        type: Number,
        default: 0,
        min: [0, 'Selling price cannot be negative']
        // Visible to everyone
    },

    // ============ Location within warehouse ============
    location: {
        shelf: { type: String, default: '' },
        bin: { type: String, default: '' }
    },

    // ============ Images ============
    images: {
        type: [String],
        default: []
        // Array of URLs to private storage
        // Never raw file paths
    },

    // ============ Supplier info ============
    supplier: {
        name: { type: String, default: '' },
        contact: { type: String, default: '' },
        email: { type: String, default: '' }
    },

    // ============ Barcode / SKU ============
    barcode: {
        type: String,
        default: null,
        trim: true
    },
    sku: {
        type: String,
        default: null,
        trim: true,
        uppercase: true
        // Unique per company (partial index — sparse-like fix)
    },

    // ============ Inventory mode (blind count) ============
    isBlurry: {
        type: Boolean,
        default: false
        // When true, quantity hidden from non-authorized roles
        // Set by employer/manager when inventory mode active
    },
    actualCount: {
        type: Number,
        default: null,
        min: [0, 'Actual count cannot be negative']
        // Physical count during inventory mode
        // Only visible to employer/manager
    },
    surplusOrLacking: {
        type: Number,
        default: null
        // actualCount - quantity
        // Positive = surplus, negative = lacking
        // Only visible to employer/manager
    },

    // ============ Movement history ============
    movements: {
        type: [movementSchema],
        default: []
        // Append-only. Never modified after push.
    },

    // ============ Status ============
    isActive: {
        type: Boolean,
        default: true
    },

    // ============ Metadata ============
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// ============================================================
// Indexes
// ============================================================
// Unique: item code per warehouse
inventorySchema.index({ warehouse: 1, itemCode: 1 }, { unique: true });

// Unique: SKU per company — only when SKU is set
inventorySchema.index(
    { company: 1, sku: 1 },
    {
        unique: true,
        partialFilterExpression: { sku: { $type: 'string' } }
    }
);

// Query: items in warehouse
inventorySchema.index({ warehouse: 1, isActive: 1 });

// Query: items in branch (denormalized)
inventorySchema.index({ branch: 1, isActive: 1 });

// Query: low stock per warehouse (used by low stock alerts)
inventorySchema.index({ warehouse: 1, quantity: 1, reorderPoint: 1 });

// Query: category filter
inventorySchema.index({ company: 1, category: 1, isActive: 1 });

// Query: name search
inventorySchema.index({ name: 'text' });

// Query: barcode lookup
inventorySchema.index(
    { company: 1, barcode: 1 },
    { partialFilterExpression: { barcode: { $type: 'string' } } }
);

// ============================================================
// Pre-validate: ensure branch matches warehouse.branch
// ============================================================
inventorySchema.pre('validate', async function (next) {
    if (!this.warehouse || !this.branch) return next();

    try {
        const Warehouse = mongoose.model('Warehouse');
        const warehouse = await Warehouse.findById(this.warehouse).select('branch company');

        if (!warehouse) {
            return next(new Error('Warehouse not found'));
        }
        if (warehouse.company.toString() !== this.company.toString()) {
            return next(new Error('Warehouse does not belong to this company'));
        }
        if (warehouse.branch.toString() !== this.branch.toString()) {
            return next(new Error('Branch does not match warehouse.branch'));
        }
        next();
    } catch (err) {
        next(err);
    }
});

// ============================================================
// Pre-save: uppercase code, update timestamp
// ============================================================
inventorySchema.pre('save', function (next) {
    if (this.itemCode) this.itemCode = this.itemCode.toUpperCase().trim();
    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Method: record a movement (append-only)
// Called by services before every quantity change
// ============================================================
inventorySchema.methods.recordMovement = function ({
    type,
    quantity,
    reason = '',
    reference = null,
    performedBy,
    performedByName = ''
}) {
    if (!MOVEMENT_TYPES.includes(type)) {
        throw new Error(`Invalid movement type: ${type}`);
    }

    const previousQuantity = this.quantity;
    const newQuantity = previousQuantity + quantity;

    if (newQuantity < 0) {
        throw new Error(
            `Insufficient stock. Available: ${previousQuantity}, requested: ${Math.abs(quantity)}`
        );
    }

    this.quantity = newQuantity;
    this.movements.push({
        type,
        quantity,
        previousQuantity,
        newQuantity,
        reason,
        reference,
        performedBy,
        performedByName,
        timestamp: new Date()
    });

    return this;
};

// ============================================================
// Method: check if item is low stock
// ============================================================
inventorySchema.methods.isLowStock = function () {
    return this.quantity <= this.reorderPoint;
};

// ============================================================
// Method: check if item is out of stock
// ============================================================
inventorySchema.methods.isOutOfStock = function () {
    return this.quantity === 0;
};

// ============================================================
// Method: calculate stock value (cost-based)
// ============================================================
inventorySchema.methods.getCostValue = function () {
    return this.quantity * this.unitCost;
};

// ============================================================
// Method: calculate stock value (selling-price-based)
// ============================================================
inventorySchema.methods.getSellingValue = function () {
    return this.quantity * this.sellingPrice;
};

// ============================================================
// Method: calculate profit if all sold
// ============================================================
inventorySchema.methods.getPotentialProfit = function () {
    return this.quantity * (this.sellingPrice - this.unitCost);
};

// ============================================================
// Method: safe public JSON — role-aware
// ============================================================
inventorySchema.methods.toPublicJSON = function (viewerRole = 'sales') {
    const base = {
        id: this._id,
        itemCode: this.itemCode,
        name: this.name,
        description: this.description,
        category: this.category,
        unit: this.unit,
        quantity: this.isBlurry && !['employer', 'manager'].includes(viewerRole)
            ? null // hidden
            : this.quantity,
        minStockLevel: this.minStockLevel,
        reorderPoint: this.reorderPoint,
        sellingPrice: this.sellingPrice,
        location: this.location,
        images: this.images,
        barcode: this.barcode,
        sku: this.sku,
        isActive: this.isActive,
        isLowStock: this.isLowStock(),
        isOutOfStock: this.isOutOfStock(),
        isBlurry: this.isBlurry,
        branch: this.branch,
        warehouse: this.warehouse,
        createdAt: this.createdAt
    };

    // Cost + profit visible only to privileged roles
    if (['employer', 'manager'].includes(viewerRole)) {
        base.unitCost = this.unitCost;
        base.costValue = this.getCostValue();
        base.sellingValue = this.getSellingValue();
        base.potentialProfit = this.getPotentialProfit();
        base.actualCount = this.actualCount;
        base.surplusOrLacking = this.surplusOrLacking;
    }

    // Main stock personnel sees cost but not profit aggregates
    if (viewerRole === 'stock_main') {
        base.unitCost = this.unitCost;
        base.costValue = this.getCostValue();
    }

    return base;
};

inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

// ============================================================
// Expose constants
// ============================================================
inventorySchema.statics.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;
inventorySchema.statics.DEFAULT_UNITS = DEFAULT_UNITS;
inventorySchema.statics.MOVEMENT_TYPES = MOVEMENT_TYPES;

module.exports = mongoose.model('Inventory', inventorySchema);