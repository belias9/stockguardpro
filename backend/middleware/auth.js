/**
 * Authentication & Authorization Middleware
 * 4-dimension access control: auth → role → function → branch.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// ============================================================
// protect — verify JWT, attach req.user
// ============================================================
const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Not authorized — no token'
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            const message = err.name === 'TokenExpiredError'
                ? 'Token expired'
                : 'Invalid token';
            return res.status(401).json({ success: false, error: message });
        }

        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ success: false, error: 'User no longer exists' });
        }

        if (!user.isActive) {
            return res.status(403).json({ success: false, error: 'Account deactivated' });
        }

        req.user = user;
        if (user.role === 'employee') {
            const Policy = require('../models/CompanyPolicy');
            const requiredPolicies = await Policy.find({ company: user.company, active: true, requiresAcknowledgment: true }).select('version acknowledgments.employee acknowledgments.version');
            const pendingAcknowledgment = requiredPolicies.some(p => !p.acknowledgments.some(a => String(a.employee) === String(user._id) && a.version === p.version));
            const inPoliciesRoute = (req.baseUrl || '').startsWith('/api/policies');
            if (pendingAcknowledgment && !inPoliciesRoute) return res.status(428).json({ success: false, error: 'Read and acknowledge current company policies before using the system', requiresPolicyAcknowledgment: true });
            req.user.mustAcknowledgePolicies = pendingAcknowledgment;
        }
        // The oldest registered employer is treated as company owner for legacy
        // tenants. Other employers receive only explicitly delegated scopes.
        if (user.role === 'employer') {
            const Company = require('../models/company');
            const company = await Company.findById(user.company).select('primaryEmployer');
            if (company) {
                if (!company.primaryEmployer) {
                    const owner = await User.findOne({ company: user.company, role: 'employer', isActive: true }).sort({ createdAt: 1, _id: 1 }).select('_id');
                    if (owner) { company.primaryEmployer = owner._id; await company.save(); }
                }
                if (company.primaryEmployer && String(company.primaryEmployer) !== String(user._id)) {
                    const route = `${req.baseUrl || ''}${req.path || ''}`;
                    const scopeMap = [
                        ['/api/company/employers', 'governance'], ['/api/company/governance', 'governance'],
                        ['/api/accounting', 'accounting'], ['/api/ai', 'analytics'], ['/api/audit', 'analytics'], ['/api/dashboard', 'analytics'], ['/api/reports', 'analytics'], ['/api/customers', 'analytics'],
                        ['/api/users', 'people'], ['/api/attendance', 'workforce'], ['/api/salary', 'workforce'],
                        ['/api/inventory', 'inventory'], ['/api/receipts', 'operations'], ['/api/withdrawals', 'operations'], ['/api/cashier', 'operations'], ['/api/pre-records', 'operations'],
                        ['/api/communication', 'communications'], ['/api/whatsapp', 'communications'],
                        ['/api/company', 'administration'], ['/api/branches', 'administration'], ['/api/warehouses', 'administration'], ['/api/devices', 'administration'], ['/api/policies', 'administration'], ['/api/end-of-day', 'analytics']
                    ];
                    const requiredScope = scopeMap.find(([prefix]) => route.startsWith(prefix))?.[1] || 'governance';
                    if (!user.employerPermissions?.includes(requiredScope)) {
                        logger.warn('[Auth] Co-employer scope denied', { userId: user._id, requiredScope, route });
                        return res.status(403).json({ success: false, error: `Primary employer has not granted ${requiredScope} access` });
                    }
                }
            }
        }
        next();
    } catch (err) {
        logger.error('[Auth] protect failed:', err.message);
        return res.status(401).json({ success: false, error: 'Not authorized' });
    }
};

// ============================================================
// authorize — role check (employer | employee)
// ============================================================
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        if (!roles.includes(req.user.role)) {
            logger.warn('[Auth] Role denied', {
                userId: req.user._id,
                userRole: req.user.role,
                requiredRoles: roles,
                path: req.path
            });
            return res.status(403).json({
                success: false,
                error: `Role '${req.user.role}' not authorized for this action`
            });
        }
        next();
    };
};

// ============================================================
// authorizeFunction — employee function check
// Employer always passes. Employee must have at least one required function.
// ============================================================
const authorizeFunction = (...functions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        // Employer bypasses function checks
        if (req.user.role === 'employer') return next();

        // Employee must have one of the required active roles
        const activeRoles = req.user.activeRoles || [];
        const hasFunction = functions.some(fn => activeRoles.includes(fn));

        if (!hasFunction) {
            logger.warn('[Auth] Function denied', {
                userId: req.user._id,
                userFunctions: activeRoles,
                requiredFunctions: functions,
                path: req.path
            });
            return res.status(403).json({
                success: false,
                error: 'You do not have permission for this action'
            });
        }
        next();
    };
};

// Explicit employer delegation for a single task. Permissions are loaded from
// MongoDB by protect on every request, so revocation takes effect immediately.
const authorizeTask = (...requirements) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const granted = requirements.some(key => key.includes('.')
        ? req.user.delegatedPermissions?.some(p => p.key === key && p.enabled)
        : req.user.activeRoles?.includes(key));
    if (req.user.role === 'employer' || granted) return next();
    logger.warn('[Auth] Delegated task denied', { userId: req.user._id, requirements, path: req.path });
    return res.status(403).json({ success: false, error: 'Employer has not granted this task permission' });
};

// ============================================================
// authorizeBranch — branch context enforcement
// Employer can switch (X-Branch-Id header) or see all.
// Employee locked to own branch.
// ============================================================
const authorizeBranch = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        // Employer: may specify branch or see all
        if (req.user.role === 'employer') {
            const requestedBranch = req.headers['x-branch-id'];
            if (requestedBranch && requestedBranch !== 'all') {
                // Verify branch belongs to company
                const Branch = require('../models/Branch');
                const branch = await Branch.findOne({
                    _id: requestedBranch,
                    company: req.user.company
                });
                if (!branch) {
                    return res.status(403).json({
                        success: false,
                        error: 'Branch not authorized'
                    });
                }
                req.branch = requestedBranch;
            } else {
                req.branch = null; // null = all branches
            }
            return next();
        }

        // Employee: locked to own branch
        if (!req.user.branch) {
            return res.status(403).json({
                success: false,
                error: 'User not assigned to any branch'
            });
        }
        req.branch = req.user.branch;
        next();
    } catch (err) {
        logger.error('[Auth] authorizeBranch failed:', err.message);
        return res.status(500).json({ success: false, error: 'Branch verification failed' });
    }
};

module.exports = { protect, authorize, authorizeFunction, authorizeTask, authorizeBranch };
