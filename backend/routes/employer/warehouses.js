/**
 * Warehouse Routes — Employer only
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../../middleware/auth');
const warehouseService = require('../../services/warehouseService');

router.use(protect, authorize('employer'));

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg, fields: errors.array() });
    }
    next();
};

router.get('/', async (req, res, next) => {
    try {
        const result = await warehouseService.listWarehouses(req);
        res.json({ success: true, ...result });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const warehouse = await warehouseService.getWarehouse(req, req.params.id);
        res.json({ success: true, warehouse });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

router.post('/', [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('code').trim().notEmpty().withMessage('Code required'),
    body('branchId').notEmpty().withMessage('Branch required')
], validate, async (req, res, next) => {
    try {
        const warehouse = await warehouseService.createWarehouse(req, req.body);
        res.status(201).json({ success: true, warehouse });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

router.put('/:id', async (req, res, next) => {
    try {
        const warehouse = await warehouseService.updateWarehouse(req, req.params.id, req.body);
        res.json({ success: true, warehouse });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const warehouse = await warehouseService.deactivateWarehouse(req, req.params.id);
        res.json({ success: true, message: 'Warehouse deactivated', warehouse });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

module.exports = router;