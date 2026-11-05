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
const mongoose = require('mongoose');
const crypto = require('crypto');

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

        // Verify signature with constant-time comparison.
        const syncSecret = process.env.SYNC_SECRET;
        if (!syncSecret || syncSecret.length < 32) return res.status(503).json({ success: false, error: 'Sync signing secret is not configured securely' });
        const expected = syncService.signPayload(req.body, syncSecret);
        const supplied = Buffer.from(String(signature));
        const expectedBytes = Buffer.from(expected);
        if (supplied.length !== expectedBytes.length || !crypto.timingSafeEqual(supplied, expectedBytes)) {
            logger.warn('[Sync] Invalid signature');
            return res.status(401).json({ success: false, error: 'Invalid signature' });
        }

        const { action, entityType, entityId, payload, localId } = req.body;

        if (!['CREATE', 'UPDATE', 'DELETE'].includes(action) || !entityType || !mongoose.Types.ObjectId.isValid(entityId) || !mongoose.Types.ObjectId.isValid(company) || !mongoose.Types.ObjectId.isValid(branch) || !/^[a-zA-Z0-9-]{12,100}$/.test(String(localId || '')) || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const payloadCompany = payload.company && String(payload.company._id || payload.company);
        const payloadBranch = payload.branch && String(payload.branch._id || payload.branch);
        const payloadSourceBranch = payload.sourceBranch && String(payload.sourceBranch._id || payload.sourceBranch);
        if (payloadCompany && payloadCompany !== String(company)) return res.status(400).json({ success: false, error: 'Payload company does not match signed company' });
        if (payloadBranch && payloadBranch !== String(branch) && payloadSourceBranch !== String(branch)) return res.status(400).json({ success: false, error: 'Payload branch does not match signed branch' });

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
            InventoryAudit: require('../../models/InventoryAudit'),
            AccountingEntry: require('../../models/AccountingEntry'),
            JournalEntry: require('../../models/JournalEntry')
        };

        const Model = modelMap[entityType];
        if (!Model) {
            return res.status(400).json({ success: false, error: `Unknown entity: ${entityType}` });
        }

        const tenantQuery = { _id: entityId, company };
        if (Model.schema.path('branch')) tenantQuery.branch = branch;
        else if (entityType === 'Withdrawal') tenantQuery.$or = [{ sourceBranch: branch }, { destinationBranch: branch }];
        let serverId = entityId;

        if (action === 'CREATE') {
            const alreadyThere = await Model.findOne(tenantQuery).select('_id');
            if (!alreadyThere) {
                const safePayload = { ...payload, company };
                if (Model.schema.path('branch')) safePayload.branch = branch;
                if (entityType === 'JournalEntry') {
                    const ledgerService = require('../../services/ledgerService');
                    const accounts = await ledgerService.ensureDefaultAccounts(company);
                    const byCode = new Map(accounts.map(account => [account.code, account]));
                    safePayload.lines = (payload.lines || []).map(line => {
                        const account = byCode.get(String(line.accountCode || '').toUpperCase());
                        if (!account) throw Object.assign(new Error(`Cloud chart of accounts is missing ${line.accountCode}`), { status: 409 });
                        return { ...line, account: account._id, accountCode: account.code, accountName: account.name };
                    });
                }
                const doc = await Model.create(safePayload);
                serverId = doc._id;
            } else serverId = alreadyThere._id;
        } else if (action === 'UPDATE') {
            const doc = await Model.findOne(tenantQuery).select('syncRevision');
            if (!doc) return res.status(409).json({ success: false, error: 'Target record is missing or outside the signed tenant/branch scope' });
            const localRevision = Number(payload.syncRevision ?? payload.$set?.syncRevision);
            if (Number.isInteger(localRevision) && localRevision > 0 && (doc.syncRevision || 0) !== localRevision - 1) {
                return res.status(409).json({ success: false, error: 'Cloud record changed after this local update; manual conflict review is required' });
            }
            const updatePayload = payload.$set || Object.keys(payload).some(key => key.startsWith('$')) ? structuredClone(payload) : { $set: structuredClone(payload) };
            if (entityType === 'JournalEntry' && updatePayload.$set?.lines) {
                const accounts = await require('../../services/ledgerService').ensureDefaultAccounts(company);
                const byCode = new Map(accounts.map(account => [account.code, account]));
                updatePayload.$set.lines = updatePayload.$set.lines.map(line => {
                    const account = byCode.get(String(line.accountCode || '').toUpperCase());
                    if (!account) throw Object.assign(new Error(`Cloud chart of accounts is missing ${line.accountCode}`), { status: 409 });
                    return { ...line, account: account._id, accountCode: account.code, accountName: account.name };
                });
            }
            for (const key of ['_id', 'company', 'branch', 'sourceBranch', 'destinationBranch']) {
                if (updatePayload.$set) delete updatePayload.$set[key];
                else delete updatePayload[key];
            }
            const updated = await Model.findOneAndUpdate(tenantQuery, updatePayload, { new: true, runValidators: true });
            if (!updated) return res.status(409).json({ success: false, error: 'Record changed while synchronization was running' });
            if (entityType === 'AccountingEntry' && updated.status === 'approved') await require('../../services/ledgerService').postAccountingEntry(updated, updated.approvedBy || updated.createdBy);
            if (entityType === 'Receipt' && updated.paymentStatus === 'confirmed') await require('../../services/ledgerService').postReceipt(updated);
        } else if (action === 'DELETE') {
            const current = await Model.findOne(tenantQuery).select('syncRevision');
            if (!current) return res.status(409).json({ success: false, error: 'Target record is missing or outside the signed tenant/branch scope' });
            const localRevision = Number(payload.syncRevision ?? payload.$set?.syncRevision);
            if (Number.isInteger(localRevision) && localRevision > 0 && (current.syncRevision || 0) !== localRevision - 1) {
                return res.status(409).json({ success: false, error: 'Cloud record changed after this local deletion; manual conflict review is required' });
            }
            const deleted = await Model.findOneAndUpdate(tenantQuery, { $set: { isActive: false, syncRevision: localRevision || (current.syncRevision || 0) + 1 } }, { new: true });
            if (!deleted) return res.status(409).json({ success: false, error: 'Target record is missing or outside the signed tenant/branch scope' });
        }

        if (entityType === 'AccountingEntry' && action === 'CREATE') {
            const accountingEntry = await require('../../models/AccountingEntry').findById(serverId);
            if (accountingEntry?.status === 'approved') await require('../../services/ledgerService').postAccountingEntry(accountingEntry, accountingEntry.approvedBy || accountingEntry.createdBy);
        }
        if (entityType === 'Receipt' && action === 'CREATE') {
            const receipt = await require('../../models/Receipt').findById(serverId);
            if (receipt?.paymentStatus === 'confirmed') await require('../../services/ledgerService').postReceipt(receipt);
        }

        // Persist idempotency after applying; CREATE itself uses the original
        // document id so a retry cannot create a second business record.
        await SyncQueue.findOneAndUpdate({ localId }, { $set: { company, branch, action, entityType, entityId, payload, status: 'synced', syncedAt: new Date(), serverId, error: '' }, $setOnInsert: { localId } }, { upsert: true, new: true, runValidators: true });

        res.json({ success: true, serverId });
    } catch (err) {
        if (err.code === 11000) return res.status(200).json({ success: true, duplicate: true });
        if (err.status === 409) return res.status(409).json({ success: false, error: err.message });
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
