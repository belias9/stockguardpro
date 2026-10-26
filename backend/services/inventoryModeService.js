/**
 * Inventory Mode Service
 * Blind count: start → count → approve → end.
 */
const InventoryAudit = require('../models/InventoryAudit');
const Inventory = require('../models/Inventory');
const Warehouse = require('../models/Warehouse');
const auditHelper = require('../utils/auditHelper');

// ============================================================
// Start inventory mode
// ============================================================
async function startAudit(req, data) {
    const { warehouseId, notes } = data;

    if (!warehouseId) throw { status: 400, message: 'Warehouse required' };

    // Employer or manager only
    if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('manager')) {
        throw { status: 403, message: 'Only employer or manager can start inventory mode' };
    }

    // Validate warehouse
    const wh = await Warehouse.findOne({ _id: warehouseId, company: req.user.company, isActive: true });
    if (!wh) throw { status: 404, message: 'Warehouse not found' };

    if (req.user.role !== 'employer' && wh.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'You can only start audits in your branch' };
    }

    // Check for existing active audit
    const existing = await InventoryAudit.findOne({
        warehouse: warehouseId,
        status: 'in_progress'
    });
    if (existing) {
        throw { status: 400, message: 'An inventory audit is already in progress for this warehouse' };
    }

    // Get all inventory in warehouse
    const items = await Inventory.find({
        warehouse: warehouseId,
        isActive: true
    });

    if (items.length === 0) {
        throw { status: 400, message: 'No inventory items to audit' };
    }

    // Create audit with snapshot
    const audit = new InventoryAudit({
        company: req.user.company,
        branch: wh.branch,
        warehouse: warehouseId,
        startedBy: req.user._id,
        startedByName: `${req.user.firstName} ${req.user.lastName}`,
        items: items.map(inv => ({
            inventoryItem: inv._id,
            itemCode: inv.itemCode,
            itemName: inv.name,
            unit: inv.unit,
            systemQuantity: inv.quantity,
            actualCount: null,
            surplusOrLacking: null
        })),
        notes: notes || ''
    });

    await audit.save();

    // Set blurry flag on all items
    await Inventory.updateMany(
        { warehouse: warehouseId, isActive: true },
        { isBlurry: true }
    );

    await auditHelper.log(req, {
        action: 'INVENTORY_MODE_START',
        entityType: 'InventoryAudit',
        entityId: audit._id,
        entityName: audit.auditId,
        changes: { after: { warehouse: warehouseId, itemCount: items.length } }
    });

    return audit.toPublicJSON('employer');
}

// ============================================================
// Record count (Stock only, actual hidden)
// ============================================================
async function recordCount(req, auditId, data) {
    const { inventoryItemId, actualCount } = data;

    if (actualCount === undefined || actualCount < 0) {
        throw { status: 400, message: 'Valid actual count required' };
    }

    const audit = await InventoryAudit.findOne({
        _id: auditId,
        company: req.user.company,
        status: 'in_progress'
    });
    if (!audit) throw { status: 404, message: 'Active audit not found' };

    if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('stock')) {
        throw { status: 403, message: 'Only stock personnel can count' };
    }

    if (req.user.role !== 'employer' && audit.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'You can only count in your branch' };
    }

    try {
        audit.recordCount(inventoryItemId, parseFloat(actualCount), req.user);
    } catch (err) {
        throw { status: 400, message: err.message };
    }

    await audit.save();

    // Stock user sees count recorded but not actual
    return audit.toPublicJSON(req.user.role === 'employer' ? 'employer' : 'stock');
}

// ============================================================
// Get audit (role-aware)
// ============================================================
async function getAudit(req, id) {
    const audit = await InventoryAudit.findOne({ _id: id, company: req.user.company })
        .populate('warehouse', 'name code')
        .populate('branch', 'name code')
        .populate('startedBy', 'firstName lastName');

    if (!audit) throw { status: 404, message: 'Audit not found' };

    if (req.user.role !== 'employer' && audit.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'Not authorized' };
    }

    const viewerRole = req.user.role === 'employer' || req.user.activeRoles?.includes('manager')
        ? 'employer'
        : 'stock';

    return audit.toPublicJSON(viewerRole);
}

// ============================================================
// List audits
// ============================================================
async function listAudits(req) {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company };
    if (req.user.role !== 'employer') query.branch = req.user.branch;
    else if (req.branch) query.branch = req.branch;
    if (status) query.status = status;

    const audits = await InventoryAudit.find(query)
        .populate('warehouse', 'name code')
        .populate('branch', 'name code')
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await InventoryAudit.countDocuments(query);

    const viewerRole = req.user.role === 'employer' || req.user.activeRoles?.includes('manager')
        ? 'employer'
        : 'stock';

    return {
        audits: audits.map(a => a.toPublicJSON(viewerRole)),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

// ============================================================
// Complete audit (Employer/Manager only, applies corrections)
// ============================================================
async function completeAudit(req, id) {
    const audit = await InventoryAudit.findOne({
        _id: id,
        company: req.user.company,
        status: 'in_progress'
    });
    if (!audit) throw { status: 404, message: 'Active audit not found' };

    if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('manager')) {
        throw { status: 403, message: 'Only employer or manager can complete audit' };
    }

    if (req.user.role !== 'employer' && audit.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'Not authorized' };
    }

    // Require all items counted
    const uncounted = audit.items.filter(i => i.actualCount === null);
    if (uncounted.length > 0) {
        throw { status: 400, message: `${uncounted.length} item(s) not yet counted` };
    }

    // Apply actual counts to inventory
    for (const item of audit.items) {
        const inv = await Inventory.findById(item.inventoryItem);
        if (!inv) continue;

        const diff = item.actualCount - inv.quantity;
        if (diff !== 0) {
            inv.recordMovement({
                type: 'adjustment',
                quantity: diff,
                reason: `Inventory audit ${audit.auditId}`,
                reference: audit.auditId,
                performedBy: req.user._id,
                performedByName: `${req.user.firstName} ${req.user.lastName}`
            });
            inv.actualCount = item.actualCount;
            inv.surplusOrLacking = diff;
            await inv.save();
        }
    }

    // Clear blurry flag
    await Inventory.updateMany(
        { warehouse: audit.warehouse, isActive: true },
        { isBlurry: false }
    );

    audit.complete(req.user);
    await audit.save();

    await auditHelper.log(req, {
        action: 'INVENTORY_MODE_END',
        entityType: 'InventoryAudit',
        entityId: audit._id,
        entityName: audit.auditId,
        changes: { after: { summary: audit.summary } }
    });

    return audit.toPublicJSON('employer');
}

// ============================================================
// Cancel audit (rollback)
// ============================================================
async function cancelAudit(req, id) {
    const audit = await InventoryAudit.findOne({
        _id: id,
        company: req.user.company,
        status: 'in_progress'
    });
    if (!audit) throw { status: 404, message: 'Active audit not found' };

    if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('manager')) {
        throw { status: 403, message: 'Only employer or manager can cancel audit' };
    }

    // Clear blurry flag
    await Inventory.updateMany(
        { warehouse: audit.warehouse, isActive: true },
        { isBlurry: false }
    );

    audit.cancel();
    await audit.save();

    await auditHelper.log(req, {
        action: 'UPDATE',
        entityType: 'InventoryAudit',
        entityId: audit._id,
        entityName: audit.auditId,
        severity: 'warning'
    });

    return audit.toPublicJSON('employer');
}

module.exports = { startAudit, recordCount, getAudit, listAudits, completeAudit, cancelAudit };