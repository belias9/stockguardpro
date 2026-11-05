/**
 * Inventory Routes
 * Stock personnel and employer can add/edit/adjust.
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorizeFunction, authorizeTask } = require('../../../middleware/auth');
const inventoryService = require('../../../services/inventoryService');
const Warehouse = require('../../../models/Warehouse');

router.use(protect);

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg, fields: errors.array() });
    }
    next();
};

// GET /api/inventory
router.get('/', authorizeTask('inventory.adjust', 'receipts.create', 'stock', 'manager', 'sales', 'shop_buyer', 'cashier', 'none'), async (req, res, next) => {
    try { res.json({ success: true, ...(await inventoryService.listInventory(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// GET /api/inventory/low-stock
router.get('/low-stock', authorizeTask('inventory.adjust', 'stock', 'manager', 'sales', 'shop_buyer', 'cashier', 'none'), async (req, res, next) => {
    try { res.json({ success: true, ...(await inventoryService.getLowStock(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/options', authorizeFunction('stock', 'manager'), async (req, res, next) => {
    try {
        const warehouses = await Warehouse.find({ company: req.user.company, branch: req.user.branch, isActive: true }).select('_id name code branch').sort({ name: 1 });
        res.json({ success: true, warehouses });
    } catch (err) { next(err); }
});

// GET /api/inventory/:id
router.get('/:id', authorizeTask('inventory.adjust', 'stock', 'manager', 'sales', 'shop_buyer', 'cashier', 'none'), async (req, res, next) => {
    try { res.json({ success: true, item: await inventoryService.getItem(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST /api/inventory
router.post('/', authorizeFunction('stock', 'manager'), [
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
router.put('/:id', authorizeFunction('stock', 'manager'), async (req, res, next) => {
    try { res.json({ success: true, item: await inventoryService.updateItem(req, req.params.id, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST /api/inventory/:id/adjust
router.post('/:id/adjust', authorizeTask('inventory.adjust', 'stock', 'manager'), [
    body('adjustment').isNumeric().withMessage('Adjustment must be numeric'),
    body('reason').trim().notEmpty().withMessage('Reason required')
], validate, async (req, res, next) => {
    try { res.json({ success: true, ...(await inventoryService.adjustStock(req, req.params.id, req.body)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// DELETE /api/inventory/:id
router.delete('/:id', authorizeFunction('stock', 'manager'), async (req, res, next) => {
    try { res.json({ success: true, ...(await inventoryService.deactivateItem(req, req.params.id)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;
