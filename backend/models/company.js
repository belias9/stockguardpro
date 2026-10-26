/**
 * Company Model
 * Top-level tenant. Owns branches, warehouses, users, and all data.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MAX_EMPLOYERS = 3;

const companySchema = new mongoose.Schema({
    // ============ Identity ============
    name: {
        type: String,
        required: [true, 'Company name is required'],
        unique: true,
        trim: true,
        minlength: [2, 'Company name too short'],
        maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Company email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Company phone is required'],
        trim: true
    },

    // ============ Auth ============
    password: {
        type: String,
        required: [true, 'Company password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        select: false  // never returned by default
    },

    // ============ Address ============
    address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        zipCode: { type: String, default: '' },
        country: { type: String, default: 'Cameroon' }
    },

    // ============ Settings ============
    settings: {
        currency: { type: String, default: 'XAF' },
        timezone: { type: String, default: 'Africa/Douala' },
        workingHours: {
            start: { type: String, default: '08:00' },
            end: { type: String, default: '17:00' }
        },
        workingDays: {
            type: [String],
            default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        },
        autoDeductAbsence: { type: Boolean, default: true },
        absenceDeductionRate: { type: Number, default: 0.1, min: 0, max: 1 },

        // Receipt rules
        receiptWhatsAppThreshold: {
            type: Number,
            default: 50000,
            min: 0
        },

        // Advance rules
        advanceManagerLimit: {
            type: Number,
            default: 50000,
            min: 0
        },
        advanceMonthlyCap: {
            type: Number,
            default: 100000,
            min: 0
        },
        advanceBaseSalaryPercent: {
            type: Number,
            default: 50,
            min: 0,
            max: 100
        },

        // Open/close times
        openTime: { type: String, default: '08:00' },
        closeTime: { type: String, default: '20:00' },

        // End of day report
        endOfDayReportTime: { type: String, default: '22:00' }
    },

    // ============ Features (toggles) ============
    features: {
        ai: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: false },
        sync: { type: Boolean, default: true },
        inventoryMode: { type: Boolean, default: true },
        customerWhatsApp: { type: Boolean, default: false },
        multiCurrency: { type: Boolean, default: false }
    },

    // ============ Customization ============
    customCategories: [{
        name: { type: String, required: true },
        isActive: { type: Boolean, default: true }
    }],
    customUnits: [{
        name: { type: String, required: true },
        isActive: { type: Boolean, default: true }
    }],

    // Custom receipt template
    receiptTemplate: {
        logoUrl: { type: String, default: null },
        footerText: { type: String, default: 'Thank you for your business!' },
        showTax: { type: Boolean, default: true },
        showDiscount: { type: Boolean, default: true }
    },

    // ============ Status ============
    isActive: {
        type: Boolean,
        default: true
    },
    isOnboarding: {
        type: Boolean,
        default: true  // new company = onboarding mode
    },

    // ============ Metadata ============
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
companySchema.index({ isActive: 1 });

// ============================================================
// Pre-save: hash password
// ============================================================
companySchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// ============================================================
// Pre-save: update timestamp
// ============================================================
companySchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Method: compare password
// ============================================================
companySchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// ============================================================
// Static: enforce max employers per company
// Called from User.create() as a pre-save check
// (User model will call Company.canAddEmployer)
// ============================================================
companySchema.statics.canAddEmployer = async function (companyId) {
    const User = mongoose.model('User');
    const count = await User.countDocuments({
        company: companyId,
        role: 'employer',
        isActive: true
    });
    return count < MAX_EMPLOYERS;
};

// ============================================================
// Virtual: employer count (for reporting)
// ============================================================
companySchema.virtual('maxEmployers').get(function () {
    return MAX_EMPLOYERS;
});

// ============================================================
// Ensure virtuals appear in JSON
// ============================================================
companySchema.set('toJSON', { virtuals: true });
companySchema.set('toObject', { virtuals: true });

// ============================================================
// Expose constant
// ============================================================
companySchema.statics.MAX_EMPLOYERS = MAX_EMPLOYERS;

module.exports = mongoose.model('Company', companySchema);