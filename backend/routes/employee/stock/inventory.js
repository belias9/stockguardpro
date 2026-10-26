/**
 * Inventory Routes
 * Stock personnel and employer can add/edit/adjust.
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorizeFunction } = require('../../../middleware/auth');
const inventoryService = require('../../../services/inventoryService');

router.use(protect, authorizeFunction('stock', 'manager'));

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg, fields: errors.array() });
    }
    next();
};

// GET /api/inventory
router.get('/', async (req, res, next) => {
    try { res.json({ success: true, ...(await inventoryService.listInventory(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// GET /api/inventory/low-stock
router.get('/low-stock', async (req, res, next) => {
    try { res.json({ success: true, ...(await inventoryService.getLowStock(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// GET /api/inventory/:id
router.get('/:id', async (req, res, next) => {
    try { res.json({ success: true, item: await inventoryService.getItem(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST /api/inventory
router.post('/', [
    body('warehouseId').notEmpty().withMessage('Warehouse required'),
    body('itemCode').trim().notEmpty().withMessage('Item code required'),
    body('name').trim().notEmpty().withMessage('Name required'),
    body('category').trim().notEmpty().withMessage('Category required'),
    body('unit').trim().notEmpty().withMessage('Unit required'),
    body('unitCost').isNumeric().withMessage('Unit cost must be numeric')
], validate, async (req, res, next) => {
    try { res.status(201).json({ success: true, item: await inventoryService.createItem(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /api/inventory/:id
router.put('/:id', async (req, res, next) => {
    try { res.json({ success: true, item: await inventoryService.updateItem(req, req.params.id, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST /api/inventory/:id/adjust
router.post('/:id/adjust', [
    body('adjustment').isNumeric().withMessage('Adjustment must be numeric'),
    body('reason').trim().notEmpty().withMessage('Reason required')
], validate, async (req, res, next) => {
    try { res.json({ success: true, ...(await inventoryService.adjustStock(req, req.params.id, req.body)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// DELETE /api/inventory/:id
router.delete('/:id', async (req, res, next) => {
    try { res.json({ success: true, ...(await inventoryService.deactivateItem(req, req.params.id)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;