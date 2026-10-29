/**
 * Withdrawal Service
 * Full stock transfer lifecycle:
 *   pending → approved → in_transit → completed
 * Approve: Manager only (own branch)
 * Dispatch: Stock only (source warehouse)
 * Receive: Stock only (destination warehouse)
 */
const Withdrawal = require('../models/Withdrawal');
const Inventory = require('../models/Inventory');
const Warehouse = require('../models/Warehouse');
const Branch = require('../models/Branch');
const auditHelper = require('../utils/auditHelper');
const { getViewerRole } = require('./inventoryService');

// ============================================================
// List withdrawals (branch-scoped)
// ============================================================
async function listWithdrawals(req) {
    const { status, page = 1, limit = 20, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company };

    if (req.user.role !== 'employer') query.branch = req.user.branch;
    else if (req.branch) query.branch = req.branch;

    if (status) query.status = status;
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const viewerRole = getViewerRole(req.user);

    const withdrawals = await Withdrawal.find(query)
        .populate('sourceBranch', 'name code')
        .populate('destinationBranch', 'name code')
        .populate('requestedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Withdrawal.countDocuments(query);

    return {
        withdrawals: withdrawals.map(w => w.toPublicJSON(viewerRole)),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

// ============================================================
// Get single
// ============================================================
async function getWithdrawal(req, id) {
    const withdrawal = await Withdrawal.findOne({ _id: id, company: req.user.company })
        .populate('sourceBranch', 'name code type')
        .populate('destinationBranch', 'name code type')
        .populate('sourceWarehouse', 'name code')
        .populate('destinationWarehouse', 'name code')
        .populate('requestedBy', 'firstName lastName');

    if (!withdrawal) throw { status: 404, message: 'Withdrawal not found' };

    // Branch isolation
    if (req.user.role !== 'employer') {
        const userBranch = req.user.branch.toString();
        const srcBranch = withdrawal.sourceBranch._id.toString();
        const dstBranch = withdrawal.destinationBranch._id.toString();
        if (userBranch !== srcBranch && userBranch !== dstBranch) {
            throw { status: 403, message: 'Not authorized for this withdrawal' };
        }
    }

    return withdrawal.toPublicJSON(getViewerRole(req.user));
}

// ============================================================
// Create withdrawal request
// ============================================================
async function createWithdrawal(req, data) {
    const {
        items, sourceBranchId, sourceWarehouseId,
        destinationBranchId, destinationWarehouseId,
        transferType, priority, notes, receiptReference
    } = data;

    if (!items || !Array.isArray(items) || items.length === 0) {
        throw { status: 400, message: 'At least one item required' };
    }
    if (!sourceWarehouseId) throw { status: 400, message: 'Source warehouse required' };
    if (!destinationBranchId) throw { status: 400, message: 'Destination branch required' };
    if (!transferType) throw { status: 400, message: 'Transfer type required' };

    // Validate source warehouse
    const srcWh = await Warehouse.findOne({ _id: sourceWarehouseId, company: req.user.company, isActive: true });
    if (!srcWh) throw { status: 404, message: 'Source warehouse not found or inactive' };

    // Validate destination branch
    const dstBranch = await Branch.findOne({ _id: destinationBranchId, company: req.user.company, isActive: true });
    if (!dstBranch) throw { status: 404, message: 'Destination branch not found or inactive' };

    // Destination warehouse (optional)
    let dstWh = null;
    if (destinationWarehouseId) {
        dstWh = await Warehouse.findOne({ _id: destinationWarehouseId, company: req.user.company, isActive: true });
        if (!dstWh) throw { status: 404, message: 'Destination warehouse not found' };
        if (dstWh.branch.toString() !== dstBranch._id.toString()) {
            throw { status: 400, message: 'Destination warehouse does not belong to destination branch' };
        }
    }

    // Process items — validate stock availability
    const processedItems = [];
    let totalCost = 0;
    let totalItems = 0;

    for (const item of items) {
        const inv = await Inventory.findOne({ _id: item.inventoryItem, company: req.user.company, isActive: true });
        if (!inv) throw { status: 404, message: `Item not found` };

        if (inv.warehouse.toString() !== srcWh._id.toString()) {
            throw { status: 400, message: `${inv.name} is not in source warehouse` };
        }

        const qty = parseFloat(item.quantity);
        if (qty <= 0) throw { status: 400, message: `Invalid quantity for ${inv.name}` };

        if (inv.quantity < qty) {
            throw { status: 400, message: `Insufficient stock for ${inv.name}. Available: ${inv.quantity}, requested: ${qty}` };
        }

        const lineCost = qty * inv.unitCost;

        processedItems.push({
            inventoryItem: inv._id,
            itemCode: inv.itemCode,
            itemName: inv.name,
            quantity: qty,
            unit: inv.unit,
            unitCost: inv.unitCost,
            totalCost: lineCost
        });

        totalCost += lineCost;
        totalItems += qty;
    }

    const withdrawal = new Withdrawal({
        company: req.user.company,
        sourceBranch: srcWh.branch,
        sourceWarehouse: srcWh._id,
        destinationBranch: dstBranch._id,
        destinationWarehouse: dstWh ? dstWh._id : null,
        transferType,
        requestedBy: req.user._id,
        requesterName: `${req.user.firstName} ${req.user.lastName}`,
        requesterRole: req.user.role === 'employer' ? 'employer' : (req.user.activeRoles?.[0] || 'employee'),
        items: processedItems,
        priority: priority || 'normal',
        notes: { requesterNotes: notes || '' },
        receiptReference: receiptReference || {},
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });

    await withdrawal.save();

    await auditHelper.log(req, {
        action: 'WITHDRAWAL_REQUEST',
        entityType: 'Withdrawal',
        entityId: withdrawal._id,
        entityName: withdrawal.withdrawalId,
        changes: { after: { totalItems, totalCost } }
    });

    return withdrawal.toPublicJSON(getViewerRole(req.user));
}

// ============================================================
// Approve (Manager only, own branch)
// ============================================================
async function approveWithdrawal(req, id, comments) {
    const withdrawal = await Withdrawal.findOne({ _id: id, company: req.user.company });
    if (!withdrawal) throw { status: 404, message: 'Withdrawal not found' };

    // Manager or employer only (function check done in route, but double-check)
    if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('manager')) {
        throw { status: 403, message: 'Only manager or employer can approve withdrawals' };
    }

    // Manager can only approve own branch's source
    if (req.user.role !== 'employer' && withdrawal.sourceBranch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'You can only approve withdrawals from your branch' };
    }

    // Cannot self-approve
    if (withdrawal.requestedBy.toString() === req.user._id.toString()) {
        throw { status: 400, message: 'You cannot approve your own withdrawal request' };
    }

    withdrawal.approve(req.user, comments || '');
    await withdrawal.save();

    await auditHelper.log(req, {
        action: 'WITHDRAWAL_APPROVE',
        entityType: 'Withdrawal',
        entityId: withdrawal._id,
        entityName: withdrawal.withdrawalId
    });

    return withdrawal.toPublicJSON(getViewerRole(req.user));
}

// ============================================================
// Reject (Manager only)
// ============================================================
async function rejectWithdrawal(req, id, reason) {
    const withdrawal = await Withdrawal.findOne({ _id: id, company: req.user.company });
    if (!withdrawal) throw { status: 404, message: 'Withdrawal not found' };

    if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('manager')) {
        throw { status: 403, message: 'Only manager or employer can reject withdrawals' };
    }

    if (req.user.role !== 'employer' && withdrawal.sourceBranch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'You can only reject withdrawals from your branch' };
    }

    if (!reason) throw { status: 400, message: 'Rejection reason required' };

    withdrawal.reject(req.user, reason);
    await withdrawal.save();

    await auditHelper.log(req, {
        action: 'WITHDRAWAL_REJECT',
        entityType: 'Withdrawal',
        entityId: withdrawal._id,
        entityName: withdrawal.withdrawalId,
        severity: 'warning'
    });

    return withdrawal.toPublicJSON(getViewerRole(req.user));
}

// ============================================================
// Dispatch (Stock only, source warehouse)
// ============================================================
async function dispatchWithdrawal(req, id, data) {
    const { collectorName, collectorEmployeeId, collectorPhone, method = 'password', notes } = data;

    if (!collectorName || !collectorEmployeeId) {
        throw { status: 400, message: 'Collector name and employee ID required' };
    }

    const withdrawal = await Withdrawal.findOne({ _id: id, company: req.user.company });
    if (!withdrawal) throw { status: 404, message: 'Withdrawal not found' };

    if (withdrawal.status !== 'approved') {
        throw { status: 400, message: `Cannot dispatch: status is '${withdrawal.status}'` };
    }

        // Stock personnel can only dispatch from their own warehouse
    // OLD:
    // if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('stock')) {
    //     throw { status: 403, message: 'Only stock personnel can dispatch' };
    // }

    // NEW:
    if (req.user.role !== 'employer') {
        const isStockAssist = req.user.activeRoles?.includes('stock') && !req.user.isMainStock;
        if (isStockAssist) {
            throw { status: 403, message: 'Only main stock personnel can dispatch' };
        }
        if (!req.user.activeRoles?.includes('stock') && !req.user.activeRoles?.includes('manager')) {
            throw { status: 403, message: 'Not authorized to dispatch' };
        }
    }

    // Verify stock personnel is at the source warehouse's branch
    if (req.user.role !== 'employer' && withdrawal.sourceBranch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'You can only dispatch from your branch\'s warehouse' };
    }

    // Atomic stock decrement — for each item
    for (const item of withdrawal.items) {
        const inv = await Inventory.findOne({
            _id: item.inventoryItem,
            quantity: { $gte: item.quantity }
        });

        if (!inv) {
            throw {
                status: 400,
                message: `Insufficient stock for ${item.itemName}. Another transaction may have used it.`
            };
        }

        inv.recordMovement({
            type: 'out',
            quantity: -item.quantity,
            reason: `Withdrawal ${withdrawal.withdrawalId}`,
            reference: withdrawal.withdrawalId,
            performedBy: req.user._id,
            performedByName: `${req.user.firstName} ${req.user.lastName}`
        });
        await inv.save();
    }

    withdrawal.dispatchStock(req.user, {
        collectorName,
        collectorEmployeeId,
        collectorPhone,
        method
    });
    if (notes) withdrawal.notes.dispatchNotes = notes;
    await withdrawal.save();

    await auditHelper.log(req, {
        action: 'WITHDRAWAL_DISPATCH',
        entityType: 'Withdrawal',
        entityId: withdrawal._id,
        entityName: withdrawal.withdrawalId,
        changes: { after: { collectorName, collectorEmployeeId } }
    });

    return withdrawal.toPublicJSON(getViewerRole(req.user));
}

// ============================================================
// Receive (Stock only, destination warehouse)
// ============================================================
async function receiveWithdrawal(req, id) {
    const withdrawal = await Withdrawal.findOne({ _id: id, company: req.user.company });
    if (!withdrawal) throw { status: 404, message: 'Withdrawal not found' };

    if (withdrawal.status !== 'in_transit') {
        throw { status: 400, message: `Cannot receive: status is '${withdrawal.status}'` };
    }

    if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('stock')) {
        throw { status: 403, message: 'Only stock personnel can confirm receipt' };
    }

    if (req.user.role !== 'employer' && withdrawal.destinationBranch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'You can only receive at your own branch' };
    }

    // Add stock at destination
    for (const item of withdrawal.items) {
        let dstInv;

        if (withdrawal.destinationWarehouse) {
            dstInv = await Inventory.findOne({
                warehouse: withdrawal.destinationWarehouse,
                itemCode: item.itemCode
            });
        } else {
            // No specific warehouse — try default, or first active
            const dstWh = await Warehouse.findOne({
                branch: withdrawal.destinationBranch,
                isDefault: true,
                isActive: true
            }) || await Warehouse.findOne({
                branch: withdrawal.destinationBranch,
                isActive: true
            });

            if (!dstWh) {
                throw { status: 400, message: `No active warehouse at destination branch` };
            }

            dstInv = await Inventory.findOne({
                warehouse: dstWh._id,
                itemCode: item.itemCode
            });

            if (!dstInv) {
                // Create new inventory at destination
                dstInv = new Inventory({
                    company: req.user.company,
                    branch: withdrawal.destinationBranch,
                    warehouse: dstWh._id,
                    itemCode: item.itemCode,
                    name: item.itemName,
                    category: 'other',
                    unit: item.unit,
                    quantity: 0,
                    unitCost: item.unitCost,
                    sellingPrice: item.unitCost * 1.5,
                    createdBy: req.user._id
                });
            }
        }

        if (dstInv) {
            dstInv.recordMovement({
                type: 'in',
                quantity: item.quantity,
                reason: `Withdrawal ${withdrawal.withdrawalId} received`,
                reference: withdrawal.withdrawalId,
                performedBy: req.user._id,
                performedByName: `${req.user.firstName} ${req.user.lastName}`
            });
            await dstInv.save();
        }
    }

    withdrawal.receiveStock(req.user);
    await withdrawal.save();

    await auditHelper.log(req, {
        action: 'WITHDRAWAL_RECEIVE',
        entityType: 'Withdrawal',
        entityId: withdrawal._id,
        entityName: withdrawal.withdrawalId
    });

    return withdrawal.toPublicJSON(getViewerRole(req.user));
}

module.exports = {
    listWithdrawals, getWithdrawal, createWithdrawal,
    approveWithdrawal, rejectWithdrawal,
    dispatchWithdrawal, receiveWithdrawal
};