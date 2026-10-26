/**
 * Branch Routes — Employer only
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../../middleware/auth');
const branchService = require('../../services/branchService');

router.use(protect, authorize('employer'));

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg, fields: errors.array() });
    }
    next();
};

// GET /api/branches
router.get('/', async (req, res, next) => {
    try {
        const result = await branchService.listBranches(req);
        res.json({ success: true, ...result });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

// GET /api/branches/:id
router.get('/:id', async (req, res, next) => {
    try {
        const branch = await branchService.getBranch(req, req.params.id);
        res.json({ success: true, branch });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

// POST /api/branches
router.post('/', [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('code').trim().notEmpty().withMessage('Code required'),
    body('type').isIn(['store', 'warehouse', 'office', 'mixed']).withMessage('Invalid type'),
    body('address.city').notEmpty().withMessage('City required')
], validate, async (req, res, next) => {
    try {
        const branch = await branchService.createBranch(req, req.body);
        res.status(201).json({ success: true, branch });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

// PUT /api/branches/:id
router.put('/:id', async (req, res, next) => {
    try {
        const branch = await branchService.updateBranch(req, req.params.id, req.body);
        res.json({ success: true, branch });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

// DELETE /api/branches/:id (soft delete)
router.delete('/:id', async (req, res, next) => {
    try {
        const branch = await branchService.deactivateBranch(req, req.params.id);
        res.json({ success: true, message: 'Branch deactivated', branch });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

module.exports = router;