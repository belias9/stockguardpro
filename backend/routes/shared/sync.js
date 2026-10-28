/**
 * Sync Routes
 * Cloud endpoint receives local pushes.
 * Local endpoint exposes queue status.
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');
const syncService = require('../../services/syncService');
const SyncQueue = require('../../models/SyncQueue');
const logger = require('../../utils/logger');

// ============================================================
// POST /api/sync/receive — CLOUD endpoint
// Called by local server when online
// ============================================================
router.post('/receive', async (req, res, next) => {
    try {
        const signature = req.headers['x-sync-signature'];
        const company = req.headers['x-sync-company'];
        const branch = req.headers['x-sync-branch'];

        if (!signature || !company || !branch) {
            return res.status(400).json({ success: false, error: 'Missing sync headers' });
        }

        // Verify signature
        const syncSecret = process.env.SYNC_SECRET || process.env.JWT_SECRET;
        const expected = syncService.signPayload(req.body, syncSecret);
        if (signature !== expected) {
            logger.warn('[Sync] Invalid signature');
            return res.status(401).json({ success: false, error: 'Invalid signature' });
        }

        const { action, entityType, entityId, payload, localId } = req.body;

        if (!entityType || !entityId || !localId) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Idempotency: check if already received
        const existing = await SyncQueue.findOne({ localId });
        if (existing && existing.status === 'synced') {
            return res.status(200).json({ success: true, serverId: existing.serverId, duplicate: true });
        }

        // Apply to the model
        const modelMap = {
            Inventory: require('../../models/Inventory'),
            Receipt: require('../../models/Receipt'),
            Withdrawal: require('../../models/Withdrawal'),
            Attendance: require('../../models/Attendance'),
            Salary: require('../../models/Salary'),
            PreRecord: require('../../models/PreRecord'),
            Customer: require('../../models/Customer'),
            CustomerOrder: require('../../models/CustomerOrder'),
            CashierSession: require('../../models/CashierSession'),
            InventoryAudit: require('../../models/InventoryAudit')
        };

        const Model = modelMap[entityType];
        if (!Model) {
            return res.status(400).json({ success: false, error: `Unknown entity: ${entityType}` });
        }

        let serverId = entityId;

        if (action === 'CREATE') {
            const doc = await Model.create(payload);
            serverId = doc._id;
        } else if (action === 'UPDATE') {
            const doc = await Model.findByIdAndUpdate(entityId, payload, { new: true });
            if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
        } else if (action === 'DELETE') {
            await Model.findByIdAndUpdate(entityId, { isActive: false });
        }

        // Record sync
        await SyncQueue.create({
            company,
            branch,
            action,
            entityType,
            entityId,
            payload,
            localId,
            status: 'synced',
            syncedAt: new Date(),
            serverId
        });

        res.json({ success: true, serverId });
    } catch (err) {
        logger.error('[Sync] Receive error:', err.message);
        next(err);
    }
});

// ============================================================
// GET /api/sync/status — LOCAL endpoint
// Shows queue status for the branch
// ============================================================
router.get('/status', protect, async (req, res, next) => {
    try {
        const branchId = req.user.branch || req.branch;
        const stats = await syncService.getQueueStats(branchId);
        const online = await syncService.isOnline();

        res.json({
            success: true,
            online,
            mode: process.env.APP_MODE || 'cloud',
            stats
        });
    } catch (err) { next(err); }
});

// ============================================================
// POST /api/sync/flush — LOCAL endpoint
// Manually trigger sync
// ============================================================
router.post('/flush', protect, async (req, res, next) => {
    try {
        if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('manager')) {
            return res.status(403).json({ success: false, error: 'Only manager/employer' });
        }
        const result = await syncService.flushQueue();
        res.json({ success: true, ...result });
    } catch (err) { next(err); }
});

// ============================================================
// POST /api/sync/retry — Retry failed items
// ============================================================
router.post('/retry', protect, async (req, res, next) => {
    try {
        if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('manager')) {
            return res.status(403).json({ success: false, error: 'Only manager/employer' });
        }
        const branchId = req.user.branch || req.branch;
        const result = await syncService.retryFailed(branchId);
        res.json({ success: true, ...result });
    } catch (err) { next(err); }
});

// ============================================================
// GET /api/sync/queue — View pending items
// ============================================================
router.get('/queue', protect, async (req, res, next) => {
    try {
        if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('manager')) {
            return res.status(403).json({ success: false, error: 'Only manager/employer' });
        }
        const branchId = req.user.branch || req.branch;
        const items = await SyncQueue.find({
            branch: branchId,
            status: { $in: ['pending', 'failed', 'conflict'] }
        }).sort({ createdAt: -1 }).limit(100);

        res.json({ success: true, items });
    } catch (err) { next(err); }
});

module.exports = router;