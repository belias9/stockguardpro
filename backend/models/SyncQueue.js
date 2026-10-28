/**
 * SyncQueue Model
 * Every write that happens on a local server gets queued here.
 * When internet returns, queue flushes to cloud.
 */
const mongoose = require('mongoose');

const syncQueueSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },

    // What to sync
    action: {
        type: String,
        enum: ['CREATE', 'UPDATE', 'DELETE'],
        required: true
    },
    entityType: {
        type: String,
        required: true
        // Inventory, Receipt, Withdrawal, Attendance, Salary, etc.
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },

    // Sync state
    status: {
        type: String,
        enum: ['pending', 'syncing', 'synced', 'failed', 'conflict'],
        default: 'pending',
        index: true
    },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: Date,
    syncedAt: Date,
    error: String,

    // Idempotency
    localId: { type: String, unique: true, required: true },
    serverId: { type: mongoose.Schema.Types.ObjectId, default: null },

    createdAt: { type: Date, default: Date.now }
});

syncQueueSchema.index({ company: 1, status: 1, createdAt: 1 });
syncQueueSchema.index({ status: 1, attempts: 1 });

module.exports = mongoose.model('SyncQueue', syncQueueSchema);