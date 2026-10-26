/**
 * Customer Model
 * Records customer info, contact, and order history.
 * PII protected — access restricted.
 */
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    // null = company-wide customer (not tied to branch)

    // ============ Identity ============
    name: { type: String, required: true, trim: true, maxlength: [100, 'Name too long'] },
    phone: {
        type: String,
        required: true,
        trim: true,
        index: true
        // Unique per company (compound index)
    },
    email: { type: String, default: '', trim: true, lowercase: true },
    address: { type: String, default: '', maxlength: [500, 'Address too long'] },

    // ============ WhatsApp ============
    whatsapp: {
        optedIn: { type: Boolean, default: false },
        lastMessageAt: { type: Date, default: null }
    },

    // ============ Interaction ============
    totalOrders: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    lastOrderAt: { type: Date, default: null },

    // ============ Conversation history ============
    conversationLog: [{
        type: { type: String, enum: ['incoming', 'outgoing'], required: true },
        channel: { type: String, enum: ['whatsapp', 'sms', 'in_app', 'manual'], default: 'whatsapp' },
        message: { type: String, default: '' },
        handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        handledByName: { type: String, default: null },
        automated: { type: Boolean, default: false },
        timestamp: { type: Date, default: Date.now }
    }],

    // ============ Preferences ============
    preferences: {
        favoriteCategories: { type: [String], default: [] },
        notes: { type: String, default: '' }
    },

    // ============ Status ============
    isActive: { type: Boolean, default: true },

    // ============ Metadata ============
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ============================================================
// Indexes
// ============================================================
customerSchema.index({ company: 1, phone: 1 }, { unique: true });
customerSchema.index({ company: 1, branch: 1, isActive: 1 });
customerSchema.index({ company: 1, name: 'text' });

// ============================================================
// Pre-save
// ============================================================
customerSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// ============================================================
// Methods
// ============================================================
customerSchema.methods.recordOrder = function (amount) {
    this.totalOrders += 1;
    this.totalSpent += amount;
    this.lastOrderAt = new Date();
};

customerSchema.methods.addConversation = function (entry) {
    this.conversationLog.push({
        type: entry.type,
        channel: entry.channel || 'whatsapp',
        message: entry.message || '',
        handledBy: entry.handledBy || null,
        handledByName: entry.handledByName || null,
        automated: entry.automated || false,
        timestamp: new Date()
    });
    this.whatsapp.lastMessageAt = new Date();
};

// ============================================================
// Serialization — PII protected
// ============================================================
customerSchema.methods.toPublicJSON = function (viewerRole = 'sales') {
    const base = {
        id: this._id,
        name: this.name,
        totalOrders: this.totalOrders,
        lastOrderAt: this.lastOrderAt,
        isActive: this.isActive,
        createdAt: this.createdAt
    };

    // Full PII visible to employer, manager, sales
    if (['employer', 'manager', 'sales'].includes(viewerRole)) {
        base.phone = this.phone;
        base.email = this.email;
        base.address = this.address;
        base.totalSpent = this.totalSpent;
        base.whatsapp = this.whatsapp;
        base.conversationLog = this.conversationLog;
        base.preferences = this.preferences;
    }

    return base;
};

customerSchema.set('toJSON', { virtuals: true });
customerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Customer', customerSchema);