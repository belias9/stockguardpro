/**
 * Customization Model
 * Per-company custom categories, units, fields, receipt template.
 */
const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema({
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'date', 'boolean', 'select'], default: 'text' },
    options: [String],
    required: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { _id: false });

const customizationSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        unique: true,
        index: true
    },

    // Custom categories (replaces hardcoded)
    categories: [{
        name: { type: String, required: true },
        slug: { type: String, required: true },
        isActive: { type: Boolean, default: true }
    }],

    // Custom units
    units: [{
        name: { type: String, required: true },
        abbreviation: { type: String, default: '' },
        isActive: { type: Boolean, default: true }
    }],

    // Custom item fields
    customFields: [customFieldSchema],

    // Multi-currency
    currency: {
        code: { type: String, default: 'XAF' },
        symbol: { type: String, default: 'XAF' },
        decimalPlaces: { type: Number, default: 2, min: 0, max: 4 }
    },

    // Receipt template
    receiptTemplate: {
        headerText: { type: String, default: '' },
        footerText: { type: String, default: 'Thank you for your business!' },
        logoUrl: { type: String, default: null },
        showTax: { type: Boolean, default: true },
        showDiscount: { type: Boolean, default: true },
        showWarehouse: { type: Boolean, default: false },
        showCompanyAddress: { type: Boolean, default: true }
    },

    updatedAt: { type: Date, default: Date.now }
});

customizationSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Static: get or create for company
// ============================================================
customizationSchema.statics.getForCompany = async function (companyId) {
    let doc = await this.findOne({ company: companyId });
    if (!doc) {
        doc = await this.create({
            company: companyId,
            categories: [
                { name: 'Electronics', slug: 'electronics' },
                { name: 'Clothing', slug: 'clothing' },
                { name: 'Food', slug: 'food' },
                { name: 'Furniture', slug: 'furniture' },
                { name: 'Tools', slug: 'tools' },
                { name: 'Other', slug: 'other' }
            ],
            units: [
                { name: 'Pieces', abbreviation: 'pcs' },
                { name: 'Kilograms', abbreviation: 'kg' },
                { name: 'Liters', abbreviation: 'L' },
                { name: 'Boxes', abbreviation: 'box' },
                { name: 'Cartons', abbreviation: 'ctn' }
            ]
        });
    }
    return doc;
};

module.exports = mongoose.model('Customization', customizationSchema);