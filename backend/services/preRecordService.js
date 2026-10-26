/**
 * PreRecord Service
 * Shop buyer creates purchase → Stock confirms → Inventory updated.
 */
const PreRecord = require('../models/PreRecord');
const Inventory = require('../models/Inventory');
const Warehouse = require('../models/Warehouse');
const auditHelper = require('../utils/auditHelper');

// ============================================================
// List pre-records
// ============================================================
async function listPreRecords(req) {
    const { status, page = 1, limit = 20, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company };
    if (req.user.role !== 'employer') query.branch = req.user.branch;
    else if (req.branch) query.branch = req.branch;

    // Shop buyer sees only own
    if (req.user.activeRoles?.includes('shop_buyer') && !req.user.activeRoles?.includes('manager')) {
        query.buyer = req.user._id;
    }

    if (status) query.status = status;
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const preRecords = await PreRecord.find(query)
        .populate('buyer', 'firstName lastName')
        .populate('warehouse', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await PreRecord.countDocuments(query);

    const viewerRole = req.user.role === 'employer' ? 'employer' : 'shop_buyer';

    return {
        preRecords: preRecords.map(p => p.toPublicJSON(viewerRole)),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

// ============================================================
// Get single
// ============================================================
async function getPreRecord(req, id) {
    const pr = await PreRecord.findOne({ _id: id, company: req.user.company })
        .populate('buyer', 'firstName lastName')
        .populate('warehouse', 'name code');

    if (!pr) throw { status: 404, message: 'Pre-record not found' };

    // Buyer can only see own
    if (req.user.activeRoles?.includes('shop_buyer') && !req.user.activeRoles?.includes('manager')) {
        if (pr.buyer.toString() !== req.user._id.toString()) {
            throw { status: 403, message: 'Not authorized' };
        }
    }

    return pr.toPublicJSON(req.user.role === 'employer' ? 'employer' : 'shop_buyer');
}

// ============================================================
// Create pre-record (Shop buyer only)
// ============================================================
async function createPreRecord(req, data) {
    const {
        items, warehouseId, receiptImageUrl, supplier,
        purchaseDate, notes
    } = data;

    if (!items || !Array.isArray(items) || items.length === 0) {
        throw { status: 400, message: 'At least one item required' };
    }

    if (!receiptImageUrl) {
        throw { status: 400, message: 'Receipt image is required' };
    }

    if (!warehouseId) {
        throw { status: 400, message: 'Warehouse required' };
    }

    // Validate warehouse
    const wh = await Warehouse.findOne({
        _id: warehouseId,
        company: req.user.company,
        isActive: true
    });
    if (!wh) throw { status: 404, message: 'Warehouse not found or inactive' };

    // Validate items + ensure last has image
    const processedItems = items.map((item, idx) => {
        if (!item.itemCode || !item.itemName) {
            throw { status: 400, message: `Item ${idx + 1}: code and name required` };
        }
        if (!item.quantity || item.quantity <= 0) {
            throw { status: 400, message: `Item ${idx + 1}: quantity must be > 0` };
        }
        if (item.unitCost === undefined || item.unitCost < 0) {
            throw { status: 400, message: `Item ${idx + 1}: unit cost required` };
        }

        return {
            itemCode: item.itemCode.toUpperCase(),
            itemName: item.itemName,
            category: item.category || 'other',
            unit: item.unit || 'pieces',
            quantity: parseFloat(item.quantity),
            unitCost: parseFloat(item.unitCost),
            sellingPrice: parseFloat(item.sellingPrice) || 0,
            totalCost: parseFloat(item.quantity) * parseFloat(item.unitCost),
            imageUrl: item.imageUrl || null
        };
    });

    // Last item must have image OR global receiptImageUrl serves as receipt
    const lastItem = processedItems[processedItems.length - 1];
    if (!lastItem.imageUrl) {
        lastItem.imageUrl = receiptImageUrl;
    }

    const preRecord = new PreRecord({
        company: req.user.company,
        branch: req.user.branch,
        warehouse: wh._id,
        buyer: req.user._id,
        buyerName: `${req.user.firstName} ${req.user.lastName}`,
        items: processedItems,
        receiptImageUrl,
        supplier: supplier || {},
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        notes: notes || '',
        status: 'pending'
    });

    await preRecord.save();

    await auditHelper.log(req, {
        action: 'PRE_RECORD_CREATE',
        entityType: 'PreRecord',
        entityId: preRecord._id,
        entityName: preRecord.preRecordId,
        changes: { after: { totalItems: preRecord.totalItems, totalCost: preRecord.totalCost } }
    });

    return preRecord.toPublicJSON('shop_buyer');
}

// ============================================================
// Update pre-record (buyer only, before confirm)
// ============================================================
async function updatePreRecord(req, id, data) {
    const pr = await PreRecord.findOne({ _id: id, company: req.user.company });
    if (!pr) throw { status: 404, message: 'Pre-record not found' };

    if (pr.buyer.toString() !== req.user._id.toString()) {
        throw { status: 403, message: 'Only the original buyer can edit' };
    }

    if (pr.status !== 'pending') {
        throw { status: 400, message: `Cannot edit: status is '${pr.status}'` };
    }

    if (data.items && Array.isArray(data.items)) {
        pr.items = data.items.map(item => ({
            itemCode: item.itemCode.toUpperCase(),
            itemName: item.itemName,
            category: item.category || 'other',
            unit: item.unit || 'pieces',
            quantity: parseFloat(item.quantity),
            unitCost: parseFloat(item.unitCost),
            sellingPrice: parseFloat(item.sellingPrice) || 0,
            totalCost: parseFloat(item.quantity) * parseFloat(item.unitCost),
            imageUrl: item.imageUrl || null
        }));
    }
    if (data.receiptImageUrl) pr.receiptImageUrl = data.receiptImageUrl;
    if (data.supplier) pr.supplier = data.supplier;
    if (data.notes !== undefined) pr.notes = data.notes;
    if (data.purchaseDate) pr.purchaseDate = new Date(data.purchaseDate);

    // Recalculate totals (pre-validate hook does this)
    await pr.save();

    await auditHelper.log(req, {
        action: 'UPDATE',
        entityType: 'PreRecord',
        entityId: pr._id,
        entityName: pr.preRecordId
    });

    return pr.toPublicJSON('shop_buyer');
}

// ============================================================
// Confirm (Stock only) — adds to inventory
// ============================================================
async function confirmPreRecord(req, id, notes) {
    const pr = await PreRecord.findOne({ _id: id, company: req.user.company });
    if (!pr) throw { status: 404, message: 'Pre-record not found' };

    if (pr.status !== 'pending') {
        throw { status: 400, message: `Cannot confirm: status is '${pr.status}'` };
    }

    // Stock must be in same branch as warehouse
    if (req.user.role !== 'employer') {
        const wh = await Warehouse.findById(pr.warehouse).select('branch');
        if (!wh || wh.branch.toString() !== req.user.branch.toString()) {
            throw { status: 403, message: 'You can only confirm pre-records for your branch' };
        }
    }

    // Add each item to inventory
    for (const item of pr.items) {
        let inv = await Inventory.findOne({
            warehouse: pr.warehouse,
            itemCode: item.itemCode
        });

        if (inv) {
            // Add to existing
            inv.recordMovement({
                type: 'in',
                quantity: item.quantity,
                reason: `Pre-record ${pr.preRecordId} confirmed`,
                reference: pr.preRecordId,
                performedBy: req.user._id,
                performedByName: `${req.user.firstName} ${req.user.lastName}`
            });
            await inv.save();
        } else {
            // Create new inventory entry
            inv = new Inventory({
                company: pr.company,
                branch: pr.branch,
                warehouse: pr.warehouse,
                itemCode: item.itemCode,
                name: item.itemName,
                category: item.category,
                unit: item.unit,
                quantity: 0,
                unitCost: item.unitCost,
                sellingPrice: item.sellingPrice || item.unitCost * 1.5,
                createdBy: req.user._id
            });
            inv.recordMovement({
                type: 'in',
                quantity: item.quantity,
                reason: `Pre-record ${pr.preRecordId} confirmed`,
                reference: pr.preRecordId,
                performedBy: req.user._id,
                performedByName: `${req.user.firstName} ${req.user.lastName}`
            });
            await inv.save();
        }
    }

    pr.confirm(req.user, notes || '');
    await pr.save();

    await auditHelper.log(req, {
        action: 'PRE_RECORD_CONFIRM',
        entityType: 'PreRecord',
        entityId: pr._id,
        entityName: pr.preRecordId
    });

    return pr.toPublicJSON('shop_buyer');
}

// ============================================================
// Reject (Stock only)
// ============================================================
async function rejectPreRecord(req, id, reason) {
    const pr = await PreRecord.findOne({ _id: id, company: req.user.company });
    if (!pr) throw { status: 404, message: 'Pre-record not found' };

    if (pr.status !== 'pending') {
        throw { status: 400, message: `Cannot reject: status is '${pr.status}'` };
    }

    if (!reason) throw { status: 400, message: 'Rejection reason required' };

    pr.reject(req.user, reason);
    await pr.save();

    await auditHelper.log(req, {
        action: 'PRE_RECORD_REJECT',
        entityType: 'PreRecord',
        entityId: pr._id,
        entityName: pr.preRecordId,
        severity: 'warning'
    });

    return pr.toPublicJSON('shop_buyer');
}

module.exports = { listPreRecords, getPreRecord, createPreRecord, updatePreRecord, confirmPreRecord, rejectPreRecord };