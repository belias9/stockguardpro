/**
 * User Service
 * Employer-only management of employees.
 */
const User = require('../models/User');
const Branch = require('../models/Branch');
const auditHelper = require('../utils/auditHelper');

// ============================================================
// List users (company-scoped, optional branch filter)
// ============================================================
async function listUsers(req) {
    const { branchId, role, isActive, page = 1, limit = 50, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { company: req.user.company };
    if (branchId) query.branch = branchId;
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
        query.$or = [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { employeeId: { $regex: search, $options: 'i' } }
        ];
    }

    const users = await User.find(query)
        .populate('branch', 'name code')
        .select('-password -fingerprintTemplate -faceTemplate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    return {
        users: users.map(u => u.toPublicJSON()),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
    };
}

// ============================================================
// Get single user
// ============================================================
async function getUser(req, id) {
    const user = await User.findOne({ _id: id, company: req.user.company })
        .populate('branch', 'name code type');

    if (!user) throw { status: 404, message: 'User not found' };

    return user.toPublicJSON();
}

// ============================================================
// Create user (employer only)
// ============================================================
async function createUser(req, data) {
    const {
        firstName, lastName, email, phone, password,
        role, roles, branchId, baseSalary
    } = data;

    // Validate role
    if (!['employer', 'employee'].includes(role)) {
        throw { status: 400, message: 'Invalid role' };
    }

    // Check duplicate email
    const existing = await User.findOne({ email: email.toLowerCase(), company: req.user.company });
    if (existing) throw { status: 400, message: 'Email already in use in this company' };

    // Validate branch for employees
    if (role === 'employee') {
        if (!branchId) throw { status: 400, message: 'Employees must be assigned to a branch' };
        const branch = await Branch.findOne({ _id: branchId, company: req.user.company, isActive: true });
        if (!branch) throw { status: 400, message: 'Branch not found or inactive' };
    }

    // Validate roles for employees
    if (role === 'employee') {
        if (!Array.isArray(roles) || roles.length === 0) {
            throw { status: 400, message: 'Employees must have at least one role' };
        }
    }

    // Create user (model enforces max 3 employers + auto-generates employeeId)
    const user = await User.create({
        company: req.user.company,
        role,
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone,
        password,
        roles: role === 'employee' ? roles : [],
        activeRoles: role === 'employee' ? roles : [],
        branch: role === 'employee' ? branchId : null,
        baseSalary: role === 'employee' ? (parseFloat(baseSalary) || 0) : 0,
        createdBy: req.user._id
    });

    await auditHelper.log(req, {
        action: 'USER_CREATE',
        entityType: 'User',
        entityId: user._id,
        entityName: `${user.firstName} ${user.lastName}`,
        changes: { after: { email, role, roles: user.roles, branch: user.branch } }
    });

    return user.toPublicJSON();
}

// ============================================================
// Update user (employer only)
// ============================================================
async function updateUser(req, id, data) {
    const user = await User.findOne({ _id: id, company: req.user.company });
    if (!user) throw { status: 404, message: 'User not found' };

    const before = {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        baseSalary: user.baseSalary,
        branch: user.branch,
        activeRoles: [...user.activeRoles]
    };

    // Cannot change own role
    if (id === req.user._id.toString() && data.role && data.role !== user.role) {
        throw { status: 400, message: 'You cannot change your own role' };
    }

    // Cannot demote last employer
    if (user.role === 'employer' && data.isActive === false) {
        const employerCount = await User.countDocuments({
            company: req.user.company, role: 'employer', isActive: true
        });
        if (employerCount <= 1) {
            throw { status: 400, message: 'Cannot deactivate the last active employer' };
        }
    }

    // Basic fields
    if (data.firstName !== undefined) user.firstName = data.firstName;
    if (data.lastName !== undefined) user.lastName = data.lastName;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.baseSalary !== undefined && user.role === 'employee') {
        user.baseSalary = parseFloat(data.baseSalary) || 0;
    }

    // Branch (employees only)
    if (data.branchId !== undefined && user.role === 'employee') {
        const branch = await Branch.findOne({ _id: data.branchId, company: req.user.company, isActive: true });
        if (!branch) throw { status: 400, message: 'Branch not found or inactive' };
        user.branch = data.branchId;
    }

    // Roles (employees only)
    if (data.roles !== undefined && user.role === 'employee') {
        if (!Array.isArray(data.roles) || data.roles.length === 0) {
            throw { status: 400, message: 'Employees must have at least one role' };
        }
        user.roles = data.roles;
        // Active roles ⊆ roles
        user.activeRoles = data.activeRoles !== undefined
            ? data.activeRoles.filter(r => data.roles.includes(r))
            : data.roles;
    }

    // Toggle active role (pausing one function)
    if (data.toggleRole) {
        const { role: roleToToggle, active } = data.toggleRole;
        if (!user.roles.includes(roleToToggle)) {
            throw { status: 400, message: `User does not have role '${roleToToggle}'` };
        }
        if (active && !user.activeRoles.includes(roleToToggle)) {
            user.activeRoles.push(roleToToggle);
        } else if (!active) {
            user.activeRoles = user.activeRoles.filter(r => r !== roleToToggle);
        }
    }

    // Active status
    if (data.isActive !== undefined) user.isActive = data.isActive;

    await user.save();

    await auditHelper.log(req, {
        action: 'USER_UPDATE',
        entityType: 'User',
        entityId: user._id,
        entityName: `${user.firstName} ${user.lastName}`,
        changes: { before, after: data }
    });

    return user.toPublicJSON();
}

// ============================================================
// Close account (leave / suspension)
// ============================================================
async function closeAccount(req, id, reason) {
    if (!reason) throw { status: 400, message: 'Reason required' };

    const user = await User.findOne({ _id: id, company: req.user.company });
    if (!user) throw { status: 404, message: 'User not found' };

    if (user.role === 'employer') {
        throw { status: 400, message: 'Use deactivation for employer accounts' };
    }

    user.accountClosed = true;
    user.closedAt = new Date();
    user.closedReason = reason;
    user.isActive = false;
    await user.save();

    await auditHelper.log(req, {
        action: 'USER_CLOSE_ACCOUNT',
        entityType: 'User',
        entityId: user._id,
        entityName: `${user.firstName} ${user.lastName}`,
        changes: { after: { reason } },
        severity: 'warning'
    });

    return user.toPublicJSON();
}

// ============================================================
// Reopen account
// ============================================================
async function reopenAccount(req, id) {
    const user = await User.findOne({ _id: id, company: req.user.company });
    if (!user) throw { status: 404, message: 'User not found' };

    user.accountClosed = false;
    user.closedAt = null;
    user.closedReason = null;
    user.isActive = true;
    await user.save();

    await auditHelper.log(req, {
        action: 'USER_REOPEN',
        entityType: 'User',
        entityId: user._id,
        entityName: `${user.firstName} ${user.lastName}`
    });

    return user.toPublicJSON();
}

// ============================================================
// Deactivate (soft delete)
// ============================================================
async function deactivateUser(req, id) {
    const user = await User.findOne({ _id: id, company: req.user.company });
    if (!user) throw { status: 404, message: 'User not found' };

    if (id === req.user._id.toString()) {
        throw { status: 400, message: 'You cannot deactivate your own account' };
    }

    // Prevent deactivating last employer
    if (user.role === 'employer') {
        const count = await User.countDocuments({
            company: req.user.company, role: 'employer', isActive: true
        });
        if (count <= 1) throw { status: 400, message: 'Cannot deactivate the last active employer' };
    }

    user.isActive = false;
    await user.save();

    await auditHelper.log(req, {
        action: 'USER_DEACTIVATE',
        entityType: 'User',
        entityId: user._id,
        entityName: `${user.firstName} ${user.lastName}`,
        severity: 'warning'
    });

    return user.toPublicJSON();
}

// ============================================================
// Reset user password (employer only)
// ============================================================
async function resetPassword(req, id, newPassword) {
    if (!newPassword || newPassword.length < 8) {
        throw { status: 400, message: 'Password must be at least 8 characters' };
    }

    const user = await User.findOne({ _id: id, company: req.user.company }).select('+password');
    if (!user) throw { status: 404, message: 'User not found' };

    user.password = newPassword;
    await user.save();

    await auditHelper.log(req, {
        action: 'PASSWORD_CHANGE',
        entityType: 'User',
        entityId: user._id,
        entityName: `${user.firstName} ${user.lastName}`,
        severity: 'warning'
    });

    return { message: 'Password reset successfully' };
}

module.exports = { listUsers, getUser, createUser, updateUser, closeAccount, reopenAccount, deactivateUser, resetPassword };