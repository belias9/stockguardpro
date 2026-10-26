/**
 * AuditLog Model
 * Immutable append-only log of every action.
 * No user — not even employer — can modify or delete.
 */
const mongoose = require('mongoose');

const ACTIONS = [
    // Auth
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE',
    
    // CRUD
    'CREATE', 'UPDATE', 'DELETE',
    
    // Withdrawal / transfer
    'WITHDRAWAL_REQUEST', 'WITHDRAWAL_APPROVE', 'WITHDRAWAL_REJECT',
    'WITHDRAWAL_DISPATCH', 'WITHDRAWAL_RECEIVE', 'WITHDRAWAL_COMPLETE',
    'TRANSFER_APPROVE', 'TRANSFER_REJECT',
    
    // Stock
    'STOCK_IN', 'STOCK_OUT', 'STOCK_ADJUST', 'STOCK_TRANSFER',
    'INVENTORY_MODE_START', 'INVENTORY_MODE_COUNT', 'INVENTORY_MODE_END',
    
    // Receipt / cashier
    'RECEIPT_CREATE', 'RECEIPT_CANCEL', 'RECEIPT_REFUND',
    'PAYMENT_CONFIRM', 'PAYMENT_DISPUTE',
    
    // Price
    'PRICE_APPROVAL_REQUEST', 'PRICE_APPROVAL_APPROVE', 'PRICE_APPROVAL_REJECT',
    
    // Attendance
    'ATTENDANCE_CLOCK_IN', 'ATTENDANCE_CLOCK_OUT', 'ATTENDANCE_ABSENCE_REVIEW',
    
    // Salary
    'SALARY_GENERATE', 'SALARY_PAY', 'SALARY_DISPUTE', 'SALARY_RESOLVE',
    'ADVANCE_REQUEST', 'ADVANCE_APPROVE', 'ADVANCE_REJECT',
    'BONUS_ADD', 'BONUS_APPROVE', 'BONUS_REJECT',
    
    // User
    'USER_CREATE', 'USER_UPDATE', 'USER_DEACTIVATE', 'USER_ACTIVATE',
    'USER_ROLE_ASSIGN', 'USER_ROLE_REMOVE', 'USER_CLOSE_ACCOUNT', 'USER_REOPEN',
    
    // Device
    'DEVICE_REGISTER', 'DEVICE_DEACTIVATE', 'DEVICE_BIOMETRIC_ENROLL',
    
    // Communication
    'MESSAGE_SEND', 'MESSAGE_RESPOND', 'MESSAGE_RESOLVE', 'MESSAGE_ESCALATE',
    
    // Customer
    'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_ORDER_CREATE',
    'CUSTOMER_ORDER_APPROVE', 'CUSTOMER_ORDER_REJECT', 'CUSTOMER_ORDER_FULFILL',
    
    // Pre-record
    'PRE_RECORD_CREATE', 'PRE_RECORD_CONFIRM', 'PRE_RECORD_REJECT', 'PRE_RECORD_CANCEL',
    
    // System
    'SETTINGS_UPDATE', 'FEATURE_TOGGLE', 'BRANCH_CREATE', 'BRANCH_UPDATE',
    'WAREHOUSE_CREATE', 'WAREHOUSE_UPDATE',
    'EXPORT', 'IMPORT', 'BACKUP', 'SYNC'
];

const ENTITY_TYPES = [
    'User', 'Company', 'Branch', 'Warehouse', 'Device',
    'Inventory', 'Withdrawal', 'Receipt', 'PreRecord', 'InventoryAudit',
    'Attendance', 'Salary', 'Communication', 'Customer', 'CustomerOrder',
    'CashierSession', 'EndOfDayReport', 'PriceApproval', 'Settings', 'System'
];

const auditLogSchema = new mongoose.Schema({
    // ============ Tenant ============
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },

    // ============ Action ============
    action: { type: String, enum: ACTIONS, required: true, index: true },

    // ============ Entity ============
    entityType: { type: String, enum: ENTITY_TYPES, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    entityName: { type: String, default: null },

    // ============ Actor ============
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    performedByName: { type: String, default: 'System' },
    performedByRole: { type: String, default: 'system' },

    // ============ Changes ============
    changes: {
        before: { type: mongoose.Schema.Types.Mixed, default: null },
        after: { type: mongoose.Schema.Types.Mixed, default: null },
        fieldsChanged: { type: [String], default: [] }
    },

    // ============ Request details ============
    requestDetails: {
        ipAddress: { type: String, default: null },
        userAgent: { type: String, default: null },
        method: { type: String, default: null },
        path: { type: String, default: null }
    },

    // ============ Result ============
    result: {
        success: { type: Boolean, default: true },
        statusCode: { type: Number, default: null },
        errorMessage: { type: String, default: null }
    },

    // ============ Severity ============
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info', index: true },

    // ============ Timestamp ============
    timestamp: { type: Date, default: Date.now, index: true },

    // ============ Retention ============
    retentionUntil: { type: Date, default: () => new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000) }
    // 7 years
});

// ============================================================
// Indexes
// ============================================================
auditLogSchema.index({ company: 1, timestamp: -1 });
auditLogSchema.index({ company: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ company: 1, entityType: 1, entityId: 1 });
auditLogSchema.index({ performedBy: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ company: 1, branch: 1, timestamp: -1 });

// ============================================================
// IMMUTABILITY — block all updates and deletes
// ============================================================
const blockMutation = function (next) {
    return next(new Error('Audit logs are immutable — cannot be modified or deleted'));
};

auditLogSchema.pre('updateOne', blockMutation);
auditLogSchema.pre('updateMany', blockMutation);
auditLogSchema.pre('findOneAndUpdate', blockMutation);
auditLogSchema.pre('findOneAndDelete', blockMutation);
auditLogSchema.pre('deleteOne', blockMutation);
auditLogSchema.pre('deleteMany', blockMutation);

// ============================================================
// Serialization
// ============================================================
auditLogSchema.methods.toPublicJSON = function () {
    return {
        id: this._id,
        action: this.action,
        entityType: this.entityType,
        entityId: this.entityId,
        entityName: this.entityName,
        performedBy: this.performedBy,
        performedByName: this.performedByName,
        performedByRole: this.performedByRole,
        branch: this.branch,
        changes: this.changes,
        requestDetails: this.requestDetails,
        result: this.result,
        severity: this.severity,
        timestamp: this.timestamp
    };
};

auditLogSchema.set('toJSON', { virtuals: true });
auditLogSchema.set('toObject', { virtuals: true });

auditLogSchema.statics.ACTIONS = ACTIONS;
auditLogSchema.statics.ENTITY_TYPES = ENTITY_TYPES;

module.exports = mongoose.model('AuditLog', auditLogSchema);