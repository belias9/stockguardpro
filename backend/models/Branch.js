/**
 * Branch Model
 * A physical location owned by a company.
 * Contains warehouses. Has a manager. Has its own inventory indirectly (via warehouses).
 */
const mongoose = require('mongoose');

const BRANCH_TYPES = ['store', 'warehouse', 'office', 'mixed'];

const branchSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: [true, 'Company is required'],
        index: true
    },

    // ============ Identity ============
    name: {
        type: String,
        required: [true, 'Branch name is required'],
        trim: true,
        maxlength: [100, 'Branch name cannot exceed 100 characters']
    },
    code: {
        type: String,
        required: [true, 'Branch code is required'],
        trim: true,
        uppercase: true,
        maxlength: [20, 'Branch code cannot exceed 20 characters']
        // Unique per company (enforced by compound index)
    },
    type: {
        type: String,
        enum: {
            values: BRANCH_TYPES,
            message: 'Branch type must be one of: ' + BRANCH_TYPES.join(', ')
        },
        required: [true, 'Branch type is required'],
        default: 'store'
    },

    // ============ Location ============
    address: {
        street: { type: String, default: '' },
        city: { type: String, required: [true, 'City is required'] },
        state: { type: String, default: '' },
        zipCode: { type: String, default: '' },
        country: { type: String, default: 'Cameroon' }
    },
    phone: {
        type: String,
        default: ''
    },

    // ============ Management ============
    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    // ============ Settings (branch-specific overrides) ============
    settings: {
        openTime: { type: String, default: null },   // null = inherit company
        closeTime: { type: String, default: null },
        currency: { type: String, default: null },   // null = inherit company
        receiptThreshold: { type: Number, default: null }
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
// Unique: branch code per company
branchSchema.index({ company: 1, code: 1 }, { unique: true });

// Query: list active branches for company
branchSchema.index({ company: 1, isActive: 1 });

// Query: find by manager
branchSchema.index({ manager: 1 });

// Query: branch by type
branchSchema.index({ company: 1, type: 1 });

// ============================================================
// Pre-save: uppercase code
// ============================================================
branchSchema.pre('save', function (next) {
    if (this.code) this.code = this.code.toUpperCase().trim();
    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Method: get effective settings (branch override or company default)
// ============================================================
branchSchema.methods.getEffectiveSettings = async function () {
    const Company = mongoose.model('Company');
    const company = await Company.findById(this.company).select('settings');
    if (!company) return this.settings;

    return {
        openTime: this.settings.openTime || company.settings.openTime,
        closeTime: this.settings.closeTime || company.settings.closeTime,
        currency: this.settings.currency || company.settings.currency,
        receiptThreshold: this.settings.receiptThreshold ?? company.settings.receiptWhatsAppThreshold
    };
};

// ============================================================
// Virtual: type label
// ============================================================
branchSchema.virtual('typeLabel').get(function () {
    const labels = {
        store: 'Store',
        warehouse: 'Warehouse',
        office: 'Office',
        mixed: 'Store + Warehouse'
    };
    return labels[this.type] || this.type;
});

branchSchema.set('toJSON', { virtuals: true });
branchSchema.set('toObject', { virtuals: true });

// Expose constants
branchSchema.statics.BRANCH_TYPES = BRANCH_TYPES;

module.exports = mongoose.model('Branch', branchSchema);