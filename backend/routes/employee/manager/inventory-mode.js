const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorizeFunction } = require('../../../middleware/auth');
const inventoryModeService = require('../../../services/inventoryModeService');

router.use(protect);
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
    next();
};

router.post('/start', authorizeFunction('manager'), [
    body('warehouseId').notEmpty()
], validate, async (req, res, next) => {
    try { res.status(201).json({ success: true, audit: await inventoryModeService.startAudit(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/:id/count', authorizeFunction('stock', 'manager'), [
    body('inventoryItemId').notEmpty(),
    body('actualCount').isNumeric()
], validate, async (req, res, next) => {
    try { res.json({ success: true, audit: await inventoryModeService.recordCount(req, req.params.id, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/', authorizeFunction('manager', 'stock'), async (req, res, next) => {
    try { res.json({ success: true, ...(await inventoryModeService.listAudits(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/:id', authorizeFunction('manager', 'stock'), async (req, res, next) => {
    try { res.json({ success: true, audit: await inventoryModeService.getAudit(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id/complete', authorizeFunction('manager'), async (req, res, next) => {
    try { res.json({ success: true, audit: await inventoryModeService.completeAudit(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id/cancel', authorizeFunction('manager'), async (req, res, next) => {
    try { res.json({ success: true, audit: await inventoryModeService.cancelAudit(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;