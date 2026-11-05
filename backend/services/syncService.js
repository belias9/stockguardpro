/**
 * Sync Service
 * Push queued writes to cloud when online.
 * Local server queue → cloud API.
 */
const SyncQueue = require('../models/SyncQueue');
const crypto = require('crypto');
const logger = require('../utils/logger');
let flushInProgress = false;

// ============================================================
// Queue a write for sync (called by every service on local mode)
// ============================================================
async function queueWrite({ company, branch, action, entityType, entityId, payload }) {
    // Only queue if running in LOCAL mode
    if (process.env.APP_MODE !== 'local') return null;

    try {
        const entry = await SyncQueue.create({
            company,
            branch,
            action,
            entityType,
            entityId,
            payload,
            localId: crypto.randomUUID()
        });
        logger.info('[Sync] Queued', { action, entityType, entityId });
        return entry;
    } catch (err) {
        logger.error('[Sync] Queue failed:', err.message);
        return null;
    }
}

// ============================================================
// Sign payload with HMAC (replay protection)
// ============================================================
function signPayload(payload, secret) {
    if (!secret || String(secret).length < 32) throw new Error('SYNC_SECRET must contain at least 32 characters');
    return crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
}

// ============================================================
// Check internet connectivity
// ============================================================
async function isOnline() {
    if (process.env.APP_MODE !== 'local') return true;
    if (!process.env.CLOUD_API_URL) return false;

    try {
        const res = await fetch(`${process.env.CLOUD_API_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        return res.ok;
    } catch {
        return false;
    }
}

// ============================================================
// Push pending queue to cloud
// ============================================================
async function flushQueue() {
    if (process.env.APP_MODE !== 'local') return { skipped: true };
    if (!process.env.CLOUD_API_URL) return { skipped: true };
    if (flushInProgress) return { skipped: true, reason: 'flush_in_progress' };

    const online = await isOnline();
    if (!online) {
        logger.info('[Sync] Offline — skipping flush');
        return { skipped: true, reason: 'offline' };
    }

    flushInProgress = true;
    try {
    const pending = await SyncQueue.find({ status: 'pending', attempts: { $lt: 5 } })
        .sort({ createdAt: 1 })
        .limit(50);

    if (pending.length === 0) return { flushed: 0 };

    const results = { success: 0, failed: 0, conflicts: 0 };
    const syncSecret = process.env.SYNC_SECRET;
    if (!syncSecret || syncSecret.length < 32) return { skipped: true, reason: 'SYNC_SECRET is not configured securely' };

    for (const entry of pending) {
        entry.status = 'syncing';
        entry.attempts += 1;
        entry.lastAttemptAt = new Date();
        await entry.save();

        try {
            const body = {
                action: entry.action,
                entityType: entry.entityType,
                entityId: entry.entityId,
                payload: entry.payload,
                localId: entry.localId,
                branch: entry.branch,
                timestamp: entry.createdAt.toISOString()
            };

            const signature = signPayload(body, syncSecret);

            const res = await fetch(`${process.env.CLOUD_API_URL}/sync/receive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Sync-Signature': signature,
                    'X-Sync-Branch': entry.branch.toString(),
                    'X-Sync-Company': entry.company.toString()
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(10000)
            });

            if (res.ok) {
                const data = await res.json();
                entry.status = 'synced';
                entry.syncedAt = new Date();
                entry.serverId = data.serverId || null;
                await entry.save();
                results.success++;
            } else if (res.status === 409) {
                const conflict = await res.json().catch(() => ({}));
                entry.status = 'conflict';
                entry.error = String(conflict.error || 'Conflict with cloud data').slice(0, 1000);
                await entry.save();
                results.conflicts++;
            } else {
                throw new Error(`Cloud returned ${res.status}`);
            }
        } catch (err) {
            entry.status = entry.attempts >= 5 ? 'failed' : 'pending';
            entry.error = err.message;
            await entry.save();
            results.failed++;
        }
    }

    logger.info('[Sync] Flush complete', results);
    return results;
    } finally {
        flushInProgress = false;
    }
}

// ============================================================
// Get queue stats (for UI)
// ============================================================
async function getQueueStats(branchId) {
    const pending = await SyncQueue.countDocuments({ branch: branchId, status: 'pending' });
    const failed = await SyncQueue.countDocuments({ branch: branchId, status: 'failed' });
    const conflicts = await SyncQueue.countDocuments({ branch: branchId, status: 'conflict' });
    const synced = await SyncQueue.countDocuments({ branch: branchId, status: 'synced' });

    return { pending, failed, conflicts, synced };
}

// ============================================================
// Retry failed queue items
// ============================================================
async function retryFailed(branchId) {
    await SyncQueue.updateMany(
        { branch: branchId, status: 'failed' },
        { status: 'pending', attempts: 0 }
    );
    return flushQueue();
}

// ============================================================
// Start background worker (runs every 30s)
// ============================================================
function startSyncWorker() {
    if (process.env.APP_MODE !== 'local') return;
    if (!process.env.CLOUD_API_URL) return;

    logger.info('[Sync] Worker started (every 30s)');

    SyncQueue.updateMany({ status: 'syncing', lastAttemptAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }, { $set: { status: 'pending', error: 'Recovered a stale sync attempt after server restart' } }).catch(err => logger.error('[Sync] Could not recover stale queue items:', err.message));

    setInterval(async () => {
        try {
            await flushQueue();
        } catch (err) {
            logger.error('[Sync] Worker error:', err.message);
        }
    }, parseInt(process.env.SYNC_INTERVAL_MS) || 30000);
}

module.exports = {
    queueWrite,
    isOnline,
    flushQueue,
    getQueueStats,
    retryFailed,
    startSyncWorker,
    signPayload
};
