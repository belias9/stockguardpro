/**
 * Receipt Service
 * Create sales, below-price approval, cashier confirmation.
 */
const Receipt = require('../models/Receipt');
const Inventory = require('../models/Inventory');
const Warehouse = require('../models/Warehouse');
const PriceApproval = require('../models/PriceApproval');
const User = require('../models/User');
const auditHelper = require('../utils/auditHelper');
const { getViewerRole } = require('./inventoryService');

// ============================================================
// List receipts
// ============================================================
async function listReceipts(req) {
    const { status, paymentStatus, page = 1, limit = 20, startDate, endDate, soldBy } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company };

    if (req.user.role !== 'employer') query.branch = req.user.branch;
    else if (req.branch) query.branch = req.branch;

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (soldBy) query.soldBy = soldBy;
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Sales sees own receipts only
    if (req.user.role === 'employee' && req.user.activeRoles?.includes('sales') && !req.user.activeRoles?.includes('manager')) {
        query.soldBy = req.user._id;
    }

    const viewerRole = getViewerRole(req.user);

    const receipts = await Receipt.find(query)
        .populate('soldBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Receipt.countDocuments(query);

    return {
        receipts: receipts.map(r => r.toPublicJSON(viewerRole)),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

// ============================================================
// Create receipt
// ============================================================
async function createReceipt(req, data) {
    const {
        items, customer, paymentMethod, paymentDetails,
        storeLocation, stockhouse, notes
    } = data;

    if (!items || !Array.isArray(items) || items.length === 0) {
        throw { status: 400, message: 'At least one item required' };
    }
    if (!storeLocation) throw { status: 400, message: 'Store location required' };

    const processedItems = [];
    let subtotal = 0, totalCost = 0, totalDiscount = 0, totalTax = 0;
    let hasBelowPriceItems = false;
    let originWarehouses = new Set();
    let originBranches = new Set();

    for (const item of items) {
        const inv = await Inventory.findOne({ _id: item.inventoryItem, company: req.user.company, isActive: true });
        if (!inv) throw { status: 404, message: `Item ${item.inventoryItem} not found` };

        if (req.user.role !== 'employer' && inv.branch.toString() !== req.user.branch.toString()) {
            // Allow cross-branch sales (interbranch), but mark it
            // No block — just track
        }

        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.unitPrice);
        const discount = parseFloat(item.discount || 0);
        const tax = parseFloat(item.tax || 0);

        if (qty <= 0) throw { status: 400, message: `Invalid quantity for ${inv.name}` };
        if (price <= 0) throw { status: 400, message: `Invalid price for ${inv.name}` };

        // Below-price detection
        if (price < inv.sellingPrice) {
            hasBelowPriceItems = true;
        }

        const lineTotal = qty * price - discount + tax;

        processedItems.push({
            inventoryItem: inv._id,
            itemCode: inv.itemCode,
            itemName: inv.name,
            quantity: qty,
            unit: inv.unit,
            unitPrice: price,
            unitCost: inv.unitCost,
            totalPrice: lineTotal,
            discount,
            tax,
            originWarehouse: inv.warehouse,
            originWarehouseName: (await Warehouse.findById(inv.warehouse).select('name'))?.name || ''
        });

        subtotal += qty * price;
        totalCost += qty * inv.unitCost;
        totalDiscount += discount;
        totalTax += tax;

        originWarehouses.add(inv.warehouse.toString());
        originBranches.add(inv.branch.toString());
    }

    const totalAmount = subtotal - totalDiscount + totalTax;

    const isInterWarehouse = originWarehouses.size > 1 || 
        (originWarehouses.size === 1 && !originWarehouses.has(req.user.branch?.toString()));
    const isInterBranch = originBranches.size > 1 || 
        (originBranches.size === 1 && !originBranches.has(req.user.branch?.toString()));

    // Create receipt
    const receipt = new Receipt({
        company: req.user.company,
        branch: req.user.branch,
        items: processedItems,
        paymentMethod,
        paymentDetails: paymentDetails || {},
        customer: customer || { name: 'Walk-in Customer' },
        soldBy: req.user._id,
        soldByName: `${req.user.firstName} ${req.user.lastName}`,
        storeLocation,
        isInterBranch,
        isInterWarehouse,
        hasBelowPriceItems,
        status: hasBelowPriceItems ? 'draft' : 'finalized',
        createdBy: req.user._id
    });

    await receipt.save();

    // If below-price, create approval request
    if (hasBelowPriceItems) {
        for (const item of processedItems) {
            const inv = await Inventory.findById(item.inventoryItem);
            if (item.unitPrice < inv.sellingPrice) {
                const pa = new PriceApproval({
                    company: req.user.company,
                    branch: req.user.branch,
                    type: 'below_price',
                    requestedBy: req.user._id,
                    requestedByName: `${req.user.firstName} ${req.user.lastName}`,
                    inventoryItem: item.inventoryItem,
                    itemCode: item.itemCode,
                    itemName: item.itemName,
                    quantity: item.quantity,
                    unit: item.unit,
                    listedPrice: inv.sellingPrice,
                    proposedPrice: item.unitPrice,
                    reason: notes || 'Below listed price',
                    receipt: receipt._id
                });
                await pa.save();
            }
        }
    }

    await auditHelper.log(req, {
        action: 'RECEIPT_CREATE',
        entityType: 'Receipt',
        entityId: receipt._id,
        entityName: receipt.receiptId,
        changes: { after: { totalAmount, hasBelowPriceItems } }
    });

    return receipt.toPublicJSON(getViewerRole(req.user));
}

// ============================================================
// Cashier confirms payment
// ============================================================
async function confirmPayment(req, id, notes) {
    const receipt = await Receipt.findOne({ _id: id, company: req.user.company });
    if (!receipt) throw { status: 404, message: 'Receipt not found' };

    if (req.user.role !== 'employer' && receipt.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'Not authorized' };
    }

    receipt.confirmPayment(req.user, notes || '');
    await receipt.save();

    await auditHelper.log(req, {
        action: 'PAYMENT_CONFIRM',
        entityType: 'Receipt',
        entityId: receipt._id,
        entityName: receipt.receiptId
    });

    return receipt.toPublicJSON(getViewerRole(req.user));
}

// ============================================================
// Cashier disputes
// ============================================================
async function disputePayment(req, id, reason) {
    const receipt = await Receipt.findOne({ _id: id, company: req.user.company });
    if (!receipt) throw { status: 404, message: 'Receipt not found' };

    if (req.user.role !== 'employer' && receipt.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'Not authorized' };
    }

    receipt.disputePayment(req.user, reason);
    await receipt.save();

    await auditHelper.log(req, {
        action: 'PAYMENT_DISPUTE',
        entityType: 'Receipt',
        entityId: receipt._id,
        entityName: receipt.receiptId,
        severity: 'warning'
    });

    return receipt.toPublicJSON(getViewerRole(req.user));
}

// ============================================================
// Cancel receipt
// ============================================================
async function cancelReceipt(req, id, reason) {
    const receipt = await Receipt.findOne({ _id: id, company: req.user.company });
    if (!receipt) throw { status: 404, message: 'Receipt not found' };

    if (receipt.status === 'cancelled') throw { status: 400, message: 'Already cancelled' };
    if (receipt.status === 'refunded') throw { status: 400, message: 'Already refunded' };

    if (receipt.withdrawalStatus === 'completed') {
        throw { status: 400, message: 'Cannot cancel: withdrawal already completed' };
    }

    receipt.status = 'cancelled';
    receipt.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: req.user._id,
        reason: reason || 'Cancelled'
    };
    await receipt.save();

    await auditHelper.log(req, {
        action: 'RECEIPT_CANCEL',
        entityType: 'Receipt',
        entityId: receipt._id,
        entityName: receipt.receiptId,
        severity: 'warning'
    });

    return receipt.toPublicJSON(getViewerRole(req.user));
}

// ============================================================
// Approve below-price (from PriceApproval)
// ============================================================
async function approveBelowPrice(req, approvalId) {
    const pa = await PriceApproval.findOne({ _id: approvalId, company: req.user.company, status: 'pending' });
    if (!pa) throw { status: 404, message: 'Approval not found or already processed' };

    // Only manager or employer
    if (req.user.role !== 'employer' && !req.user.activeRoles?.includes('manager')) {
        throw { status: 403, message: 'Only manager or employer can approve below-price sales' };
    }

    // Cannot approve own request
    if (pa.requestedBy.toString() === req.user._id.toString()) {
        throw { status: 400, message: 'You cannot approve your own below-price request' };
    }

    pa.approve(req.user, req.body?.comments || '');
    await pa.save();

    // If all below-price approvals for this receipt are done → finalize receipt
    const receipt = await Receipt.findById(pa.receipt);
    if (receipt) {
        const stillPending = await PriceApproval.countDocuments({
            receipt: pa.receipt, status: 'pending'
        });
        if (stillPending === 0) {
            receipt.status = 'finalized';
            await receipt.save();
        }
    }

    await auditHelper.log(req, {
        action: 'PRICE_APPROVAL_APPROVE',
        entityType: 'PriceApproval',
        entityId: pa._id,
        entityName: pa.approvalId
    });

    return pa.toPublicJSON();
}

module.exports = {
    listReceipts, createReceipt, confirmPayment,
    disputePayment, cancelReceipt, approveBelowPrice
};