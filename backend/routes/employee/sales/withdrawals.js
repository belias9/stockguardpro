/**
 * Withdrawal Routes
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorizeFunction } = require('../../../middleware/auth');
const withdrawalService = require('../../../services/withdrawalService');

router.use(protect);

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    next();
};

// GET — sales, stock, manager
router.get('/', authorizeFunction('sales', 'stock', 'manager', 'cashier'), async (req, res, next) => {
    try { res.json({ success: true, ...(await withdrawalService.listWithdrawals(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// GET /:id
router.get('/:id', authorizeFunction('sales', 'stock', 'manager', 'cashier'), async (req, res, next) => {
    try { res.json({ success: true, withdrawal: await withdrawalService.getWithdrawal(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST — create (sales, manager)
router.post('/', authorizeFunction('sales', 'manager'), [
    body('items').isArray({ min: 1 }).withMessage('At least one item'),
    body('sourceWarehouseId').notEmpty().withMessage('Source warehouse required'),
    body('destinationBranchId').notEmpty().withMessage('Destination branch required'),
    body('transferType').isIn(['store_to_warehouse', 'warehouse_to_warehouse', 'branch_to_branch'])
], validate, async (req, res, next) => {
    try { res.status(201).json({ success: true, withdrawal: await withdrawalService.createWithdrawal(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /:id/approve — manager only
router.put('/:id/approve', authorizeFunction('manager'), async (req, res, next) => {
    try { res.json({ success: true, withdrawal: await withdrawalService.approveWithdrawal(req, req.params.id, req.body.comments) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /:id/reject — manager only
router.put('/:id/reject', authorizeFunction('manager'), [
    body('reason').notEmpty().withMessage('Reason required')
], validate, async (req, res, next) => {
    try { res.json({ success: true, withdrawal: await withdrawalService.rejectWithdrawal(req, req.params.id, req.body.reason) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /:id/dispatch — stock only
router.put('/:id/dispatch', authorizeFunction('stock'), [
    body('collectorName').notEmpty().withMessage('Collector name required'),
    body('collectorEmployeeId').notEmpty().withMessage('Collector ID required')
], validate, async (req, res, next) => {
    try { res.json({ success: true, withdrawal: await withdrawalService.dispatchWithdrawal(req, req.params.id, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /:id/receive — stock only
router.put('/:id/receive', authorizeFunction('stock'), async (req, res, next) => {
    try { res.json({ success: true, withdrawal: await withdrawalService.receiveWithdrawal(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;