/**
 * Inventory Service
 * Per-warehouse stock management.
 */
const Inventory = require('../models/Inventory');
const Warehouse = require('../models/Warehouse');
const Branch = require('../models/Branch');
const auditHelper = require('../utils/auditHelper');

// ============================================================
// Determine viewer role for serialization
// ============================================================
function getViewerRole(user) {
    if (user.role === 'employer') return 'employer';
    if (user.activeRoles?.includes('manager')) return 'manager';
    if (user.activeRoles?.includes('stock')) return 'stock_main';
    if (user.activeRoles?.includes('cashier')) return 'cashier';
    if (user.activeRoles?.includes('sales')) return 'sales';
    if (user.activeRoles?.includes('shop_buyer')) return 'shop_buyer';
    return 'none';
}

// ============================================================
// List inventory (branch-scoped, filter by warehouse)
// ============================================================
async function listInventory(req) {
    const { warehouseId, category, search, lowStock, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company, isActive: true };

    // Branch isolation
    if (req.user.role !== 'employer') {
        query.branch = req.user.branch;
    } else if (req.branch) {
        query.branch = req.branch;
    }

    if (warehouseId) query.warehouse = warehouseId;
    if (category) query.category = category.toLowerCase();
    if (lowStock === 'true') {
        query.$expr = { $lte: ['$quantity', '$reorderPoint'] };
    }
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { itemCode: { $regex: search, $options: 'i' } },
            { barcode: search }
        ];
    }

    const viewerRole = getViewerRole(req.user);

    const items = await Inventory.find(query)
        .populate('warehouse', 'name code')
        .populate('branch', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Inventory.countDocuments(query);

    return {
        items: items.map(i => i.toPublicJSON(viewerRole)),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

// ============================================================
// Get low stock
// ============================================================
async function getLowStock(req) {
    const query = {
        company: req.user.company,
        isActive: true,
        $expr: { $lte: ['$quantity', '$reorderPoint'] }
    };

    if (req.user.role !== 'employer') query.branch = req.user.branch;
    else if (req.branch) query.branch = req.branch;

    const viewerRole = getViewerRole(req.user);
    const items = await Inventory.find(query)
        .populate('warehouse', 'name code')
        .sort({ quantity: 1 });

    return { items: items.map(i => i.toPublicJSON(viewerRole)), count: items.length };
}

// ============================================================
// Get single item
// ============================================================
async function getItem(req, id) {
    const item = await Inventory.findOne({ _id: id, company: req.user.company })
        .populate('warehouse', 'name code')
        .populate('branch', 'name code');

    if (!item) throw { status: 404, message: 'Item not found' };

    if (req.user.role !== 'employer' && item.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'Not authorized for this branch' };
    }

    return item.toPublicJSON(getViewerRole(req.user));
}

// ============================================================
// Create item
// ============================================================
async function createItem(req, data) {
    const { warehouseId, itemCode, name, description, category, unit, quantity, unitCost, sellingPrice, minStockLevel, reorderPoint, images, barcode, sku, supplier } = data;

    if (!warehouseId) throw { status: 400, message: 'Warehouse required' };

    // Validate warehouse belongs to user's branch (or company for employer)
    const warehouse = await Warehouse.findOne({ _id: warehouseId, company: req.user.company, isActive: true });
    if (!warehouse) throw { status: 404, message: 'Warehouse not found or inactive' };

    if (req.user.role !== 'employer' && warehouse.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'Cannot add items to another branch\'s warehouse' };
    }

    // Check duplicate item code in warehouse
    const existing = await Inventory.findOne({
        warehouse: warehouse._id,
        itemCode: itemCode.toUpperCase()
    });
    if (existing) throw { status: 400, message: `Item code '${itemCode}' already exists in this warehouse` };

    const item = new Inventory({
        company: req.user.company,
        branch: warehouse.branch,
        warehouse: warehouse._id,
        itemCode: itemCode.toUpperCase(),
        name,
        description: description || '',
        category: category.toLowerCase(),
        unit: unit.toLowerCase(),
        quantity: 0,  // always 0 — movements add stock
        unitCost: parseFloat(unitCost),
        sellingPrice: parseFloat(sellingPrice) || 0,
        minStockLevel: parseInt(minStockLevel) || 10,
        reorderPoint: parseInt(reorderPoint) || 20,
        images: images || [],
        barcode: barcode || null,
        sku: sku ? sku.toUpperCase() : null,
        supplier: supplier || {},
        createdBy: req.user._id
    });

    // If initial quantity specified, record it as a movement
    const initQty = parseFloat(quantity) || 0;
    if (initQty > 0) {
        item.recordMovement({
            type: 'in',
            quantity: initQty,
            reason: 'Initial stock',
            performedBy: req.user._id,
            performedByName: `${req.user.firstName} ${req.user.lastName}`
        });
    }

    await item.save();

    await auditHelper.log(req, {
        action: 'CREATE',
        entityType: 'Inventory',
        entityId: item._id,
        entityName: item.name,
        changes: { after: { itemCode, name, initialQty: initQty } }
    });

    return item.toPublicJSON(getViewerRole(req.user));
}

// ============================================================
// Update item
// ============================================================
async function updateItem(req, id, data) {
    const item = await Inventory.findOne({ _id: id, company: req.user.company });
    if (!item) throw { status: 404, message: 'Item not found' };

    if (req.user.role !== 'employer' && item.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'Not authorized' };
    }

    const before = {
        name: item.name,
        description: item.description,
        category: item.category,
        unit: item.unit,
        unitCost: item.unitCost,
        sellingPrice: item.sellingPrice,
        minStockLevel: item.minStockLevel,
        reorderPoint: item.reorderPoint
    };

    if (data.name !== undefined) item.name = data.name;
    if (data.description !== undefined) item.description = data.description;
    if (data.category !== undefined) item.category = data.category.toLowerCase();
    if (data.unit !== undefined) item.unit = data.unit.toLowerCase();
    if (data.unitCost !== undefined) item.unitCost = parseFloat(data.unitCost);
    if (data.sellingPrice !== undefined) item.sellingPrice = parseFloat(data.sellingPrice);
    if (data.minStockLevel !== undefined) item.minStockLevel = parseInt(data.minStockLevel);
    if (data.reorderPoint !== undefined) item.reorderPoint = parseInt(data.reorderPoint);
    if (data.images !== undefined) item.images = data.images;
    if (data.supplier !== undefined) item.supplier = data.supplier;

    await item.save();

    await auditHelper.log(req, {
        action: 'UPDATE',
        entityType: 'Inventory',
        entityId: item._id,
        entityName: item.name,
        changes: { before, after: data }
    });

    return item.toPublicJSON(getViewerRole(req.user));
}

// ============================================================
// Adjust stock (in / out / adjustment)
// ============================================================
async function adjustStock(req, id, data) {
    const { adjustment, reason, type = 'adjustment', reference } = data;

    if (!adjustment || !reason) throw { status: 400, message: 'Adjustment and reason required' };

    const item = await Inventory.findOne({ _id: id, company: req.user.company });
    if (!item) throw { status: 404, message: 'Item not found' };

    if (req.user.role !== 'employer' && item.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'Not authorized' };
    }

    const previousQty = item.quantity;

    try {
        item.recordMovement({
            type,
            quantity: parseFloat(adjustment),
            reason,
            reference: reference || null,
            performedBy: req.user._id,
            performedByName: `${req.user.firstName} ${req.user.lastName}`
        });
    } catch (err) {
        throw { status: 400, message: err.message };
    }

    await item.save();

    await auditHelper.log(req, {
        action: 'STOCK_ADJUST',
        entityType: 'Inventory',
        entityId: item._id,
        entityName: item.name,
        changes: {
            before: { quantity: previousQty },
            after: { quantity: item.quantity }
        }
    });

    return {
        item: item.toPublicJSON(getViewerRole(req.user)),
        adjustment: {
            previousQuantity: previousQty,
            adjustment: parseFloat(adjustment),
            newQuantity: item.quantity
        }
    };
}

// ============================================================
// Deactivate item
// ============================================================
async function deactivateItem(req, id) {
    const item = await Inventory.findOne({ _id: id, company: req.user.company });
    if (!item) throw { status: 404, message: 'Item not found' };

    if (req.user.role !== 'employer' && item.branch.toString() !== req.user.branch.toString()) {
        throw { status: 403, message: 'Not authorized' };
    }

    if (item.quantity > 0) {
        throw { status: 400, message: `Cannot deactivate: ${item.quantity} units still in stock. Adjust to 0 first.` };
    }

    item.isActive = false;
    await item.save();

    await auditHelper.log(req, {
        action: 'DELETE',
        entityType: 'Inventory',
        entityId: item._id,
        entityName: item.name
    });

    return { message: 'Item deactivated' };
}

module.exports = { listInventory, getLowStock, getItem, createItem, updateItem, adjustStock, deactivateItem, getViewerRole };