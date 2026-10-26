/**
 * Branch Context
 * Sets req.branch automatically based on user role.
 * Used by every branch-scoped query.
 */
const logger = require('../utils/logger');

const branchContext = (req, res, next) => {
    if (!req.user) {
        req.branch = null;
        return next();
    }

    // Employer: branch from header (or null = all)
    if (req.user.role === 'employer') {
        const headerBranch = req.headers['x-branch-id'];
        req.branch = (headerBranch && headerBranch !== 'all') ? headerBranch : null;
        return next();
    }

    // Employee: own branch
    req.branch = req.user.branch || null;

    if (!req.branch) {
        logger.warn('[Branch] Employee without branch', {
            userId: req.user._id,
            path: req.originalUrl
        });
    }

    next();
};

// ============================================================
// Helper — apply branch to a query object
// Usage: const query = applyBranch({ company: req.user.company }, req.branch)
// ============================================================
const applyBranch = (query, branch) => {
    if (branch) {
        query.branch = branch;
    }
    return query;
};

module.exports = { branchContext, applyBranch };