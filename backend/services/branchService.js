/**
 * Branch Service
 * Employer-only management of branches.
 */
const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');
const User = require('../models/User');
const auditHelper = require('../utils/auditHelper');

async function listBranches(req) {
    const { page = 1, limit = 50, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company };
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const branches = await Branch.find(query)
        .populate('manager', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Branch.countDocuments(query);

    return {
        branches,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

async function getBranch(req, id) {
    const branch = await Branch.findOne({ _id: id, company: req.user.company })
        .populate('manager', 'firstName lastName email');

    if (!branch) throw { status: 404, message: 'Branch not found' };

    // Also get warehouse count
    const warehouseCount = await Warehouse.countDocuments({
        branch: branch._id, isActive: true
    });

    return { ...branch.toObject(), warehouseCount };
}

async function createBranch(req, data) {
    const { name, code, type, address, phone, managerId } = data;

    // Check unique code in company
    const existing = await Branch.findOne({
        company: req.user.company,
        code: code.toUpperCase()
    });
    if (existing) throw { status: 400, message: `Branch code '${code}' already exists` };

    // Validate manager if provided
    if (managerId) {
        const manager = await User.findOne({
            _id: managerId,
            company: req.user.company,
            isActive: true
        });
        if (!manager) throw { status: 400, message: 'Manager not found' };
    }

    const branch = await Branch.create({
        company: req.user.company,
        name,
        code: code.toUpperCase(),
        type,
        address: address || {},
        phone: phone || '',
        manager: managerId || null,
        createdBy: req.user._id
    });

    await auditHelper.log(req, {
        action: 'BRANCH_CREATE',
        entityType: 'Branch',
        entityId: branch._id,
        entityName: branch.name,
        changes: { after: { name, code, type } }
    });

    return branch;
}

async function updateBranch(req, id, data) {
    const branch = await Branch.findOne({ _id: id, company: req.user.company });
    if (!branch) throw { status: 404, message: 'Branch not found' };

    const before = {
        name: branch.name,
        code: branch.code,
        type: branch.type,
        isActive: branch.isActive
    };

    // Code change — check uniqueness
    if (data.code && data.code.toUpperCase() !== branch.code) {
        const existing = await Branch.findOne({
            company: req.user.company,
            code: data.code.toUpperCase(),
            _id: { $ne: id }
        });
        if (existing) throw { status: 400, message: 'Branch code already in use' };
        branch.code = data.code.toUpperCase();
    }

    if (data.name !== undefined) branch.name = data.name;
    if (data.type !== undefined) branch.type = data.type;
    if (data.address !== undefined) branch.address = data.address;
    if (data.phone !== undefined) branch.phone = data.phone;
    if (data.managerId !== undefined) {
        if (data.managerId) {
            const manager = await User.findOne({
                _id: data.managerId,
                company: req.user.company,
                isActive: true
            });
            if (!manager) throw { status: 400, message: 'Manager not found' };
            branch.manager = data.managerId;
        } else {
            branch.manager = null;
        }
    }
    if (data.isActive !== undefined) branch.isActive = data.isActive;

    await branch.save();

    await auditHelper.log(req, {
        action: 'BRANCH_UPDATE',
        entityType: 'Branch',
        entityId: branch._id,
        entityName: branch.name,
        changes: { before, after: data }
    });

    return branch;
}

async function deactivateBranch(req, id) {
    const branch = await Branch.findOne({ _id: id, company: req.user.company });
    if (!branch) throw { status: 404, message: 'Branch not found' };

    // Check for active users
    const userCount = await User.countDocuments({
        branch: branch._id, isActive: true
    });
    if (userCount > 0) {
        throw { status: 400, message: `Cannot deactivate: ${userCount} active user(s) still assigned to this branch` };
    }

    branch.isActive = false;
    await branch.save();

    await auditHelper.log(req, {
        action: 'BRANCH_UPDATE',
        entityType: 'Branch',
        entityId: branch._id,
        entityName: branch.name,
        severity: 'warning'
    });

    return branch;
}

module.exports = { listBranches, getBranch, createBranch, updateBranch, deactivateBranch };