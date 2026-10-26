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

module.exports = { protect, authorize, authorizeFunction, authorizeBranch };