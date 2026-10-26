/**
 * Warehouse Model
 * A stock-holding sub-location within a branch.
 * Every warehouse tracks its own inventory independently.
 */
const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
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
    },

    // ============ Identity ============
    name: {
        type: String,
        required: [true, 'Warehouse name is required'],
        trim: true,
        maxlength: [100, 'Warehouse name cannot exceed 100 characters']
    },
    code: {
        type: String,
        required: [true, 'Warehouse code is required'],
        trim: true,
        uppercase: true,
        maxlength: [20, 'Warehouse code cannot exceed 20 characters']
        // Unique per company (enforced by compound index)
    },

    // ============ Location ============
    address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        zipCode: { type: String, default: '' },
        country: { type: String, default: 'Cameroon' }
    },

    // ============ Management ============
    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    // ============ Status ============
    isActive: {
        type: Boolean,
        default: true
    },
    isDefault: {
        type: Boolean,
        default: false  // default warehouse for the branch
    },

    // ============ Metadata ============
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
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
// Unique: warehouse code per company
warehouseSchema.index({ company: 1, code: 1 }, { unique: true });

// Query: warehouses for a branch
warehouseSchema.index({ branch: 1, isActive: 1 });

// Query: find by manager
warehouseSchema.index({ manager: 1 });

// Query: default warehouse lookup
warehouseSchema.index({ branch: 1, isDefault: 1 });

// ============================================================
// Pre-save: uppercase code, update timestamp
// ============================================================
warehouseSchema.pre('save', function (next) {
    if (this.code) this.code = this.code.toUpperCase().trim();
    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Static: ensure only one default per branch
// ============================================================
warehouseSchema.statics.setDefault = async function (warehouseId) {
    const warehouse = await this.findById(warehouseId);
    if (!warehouse) throw new Error('Warehouse not found');

    // Clear other defaults in the same branch
    await this.updateMany(
        { branch: warehouse.branch, _id: { $ne: warehouseId } },
        { isDefault: false }
    );

    warehouse.isDefault = true;
    await warehouse.save();
    return warehouse;
};

// ============================================================
// Virtual: full location
// ============================================================
warehouseSchema.virtual('fullLocation').get(function () {
    const parts = [
        this.address.street,
        this.address.city,
        this.address.state
    ].filter(Boolean);
    return parts.join(', ') || 'No address set';
});

warehouseSchema.set('toJSON', { virtuals: true });
warehouseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Warehouse', warehouseSchema);