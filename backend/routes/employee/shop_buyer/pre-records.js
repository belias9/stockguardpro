const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorizeFunction } = require('../../../middleware/auth');
const preRecordService = require('../../../services/preRecordService');

router.use(protect);
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
    next();
};

router.get('/', authorizeFunction('shop_buyer', 'stock', 'manager'), async (req, res, next) => {
    try { res.json({ success: true, ...(await preRecordService.listPreRecords(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/:id', authorizeFunction('shop_buyer', 'stock', 'manager'), async (req, res, next) => {
    try { res.json({ success: true, preRecord: await preRecordService.getPreRecord(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/', authorizeFunction('shop_buyer', 'manager'), [
    body('items').isArray({ min: 1 }),
    body('warehouseId').notEmpty(),
    body('receiptImageUrl').notEmpty().withMessage('Receipt image required')
], validate, async (req, res, next) => {
    try { res.status(201).json({ success: true, preRecord: await preRecordService.createPreRecord(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id', authorizeFunction('shop_buyer'), async (req, res, next) => {
    try { res.json({ success: true, preRecord: await preRecordService.updatePreRecord(req, req.params.id, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id/confirm', authorizeFunction('stock', 'manager'), async (req, res, next) => {
    try { res.json({ success: true, preRecord: await preRecordService.confirmPreRecord(req, req.params.id, req.body.notes) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id/reject', authorizeFunction('stock', 'manager'), [
    body('reason').notEmpty()
], validate, async (req, res, next) => {
    try { res.json({ success: true, preRecord: await preRecordService.rejectPreRecord(req, req.params.id, req.body.reason) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;