/**
 * Warehouse Service
 * Employer-only management of warehouses under branches.
 */
const Warehouse = require('../models/Warehouse');
const Branch = require('../models/Branch');
const Inventory = require('../models/Inventory');
const auditHelper = require('../utils/auditHelper');

async function listWarehouses(req) {
    const { branchId, page = 1, limit = 50, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company };
    if (branchId) query.branch = branchId;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const warehouses = await Warehouse.find(query)
        .populate('branch', 'name code type')
        .populate('manager', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Warehouse.countDocuments(query);

    return {
        warehouses,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

async function getWarehouse(req, id) {
    const warehouse = await Warehouse.findOne({ _id: id, company: req.user.company })
        .populate('branch', 'name code type')
        .populate('manager', 'firstName lastName email');

    if (!warehouse) throw { status: 404, message: 'Warehouse not found' };

    // Item count
    const itemCount = await Inventory.countDocuments({
        warehouse: warehouse._id, isActive: true
    });

    return { ...warehouse.toObject(), itemCount };
}

async function createWarehouse(req, data) {
    const { name, code, branchId, address, managerId, isDefault } = data;

    if (!branchId) throw { status: 400, message: 'Branch is required' };

    // Verify branch
    const branch = await Branch.findOne({ _id: branchId, company: req.user.company });
    if (!branch) throw { status: 404, message: 'Branch not found' };

    // Check unique code in company
    const existing = await Warehouse.findOne({
        company: req.user.company,
        code: code.toUpperCase()
    });
    if (existing) throw { status: 400, message: `Warehouse code '${code}' already exists` };

    const warehouse = await Warehouse.create({
        company: req.user.company,
        branch: branchId,
        name,
        code: code.toUpperCase(),
        address: address || {},
        manager: managerId || null,
        isDefault: !!isDefault,
        createdBy: req.user._id
    });

    // If this is default, clear others
    if (isDefault) {
        await Warehouse.updateMany(
            { branch: branchId, _id: { $ne: warehouse._id } },
            { isDefault: false }
        );
    }

    await auditHelper.log(req, {
        action: 'WAREHOUSE_CREATE',
        entityType: 'Warehouse',
        entityId: warehouse._id,
        entityName: warehouse.name,
        branch: branchId,
        changes: { after: { name, code, branchId } }
    });

    return warehouse;
}

async function updateWarehouse(req, id, data) {
    const warehouse = await Warehouse.findOne({ _id: id, company: req.user.company });
    if (!warehouse) throw { status: 404, message: 'Warehouse not found' };

    const before = {
        name: warehouse.name,
        code: warehouse.code,
        isDefault: warehouse.isDefault,
        isActive: warehouse.isActive
    };

    if (data.code && data.code.toUpperCase() !== warehouse.code) {
        const existing = await Warehouse.findOne({
            company: req.user.company,
            code: data.code.toUpperCase(),
            _id: { $ne: id }
        });
        if (existing) throw { status: 400, message: 'Warehouse code already in use' };
        warehouse.code = data.code.toUpperCase();
    }

    if (data.name !== undefined) warehouse.name = data.name;
    if (data.address !== undefined) warehouse.address = data.address;
    if (data.managerId !== undefined) warehouse.manager = data.managerId || null;
    if (data.isActive !== undefined) warehouse.isActive = data.isActive;

    if (data.isDefault === true && !warehouse.isDefault) {
        // Clear other defaults in this branch
        await Warehouse.updateMany(
            { branch: warehouse.branch, _id: { $ne: id } },
            { isDefault: false }
        );
        warehouse.isDefault = true;
    } else if (data.isDefault === false) {
        warehouse.isDefault = false;
    }

    await warehouse.save();

    await auditHelper.log(req, {
        action: 'WAREHOUSE_UPDATE',
        entityType: 'Warehouse',
        entityId: warehouse._id,
        entityName: warehouse.name,
        changes: { before, after: data }
    });

    return warehouse;
}

async function deactivateWarehouse(req, id) {
    const warehouse = await Warehouse.findOne({ _id: id, company: req.user.company });
    if (!warehouse) throw { status: 404, message: 'Warehouse not found' };

    // Check for inventory
    const itemCount = await Inventory.countDocuments({
        warehouse: warehouse._id, isActive: true, quantity: { $gt: 0 }
    });
    if (itemCount > 0) {
        throw { status: 400, message: `Cannot deactivate: ${itemCount} item(s) still have stock in this warehouse` };
    }

    warehouse.isActive = false;
    await warehouse.save();

    await auditHelper.log(req, {
        action: 'WAREHOUSE_UPDATE',
        entityType: 'Warehouse',
        entityId: warehouse._id,
        entityName: warehouse.name,
        severity: 'warning'
    });

    return warehouse;
}

module.exports = { listWarehouses, getWarehouse, createWarehouse, updateWarehouse, deactivateWarehouse };