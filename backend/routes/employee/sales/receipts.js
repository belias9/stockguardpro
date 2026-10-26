/**
 * Receipt Routes
 * Sales can create; cashier/manager/employer can confirm.
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorizeFunction } = require('../../../middleware/auth');
const receiptService = require('../../../services/receiptService');

router.use(protect);

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    next();
};

// GET — Sales, Manager, Employer
router.get('/', authorizeFunction('sales', 'manager', 'cashier'), async (req, res, next) => {
    try { res.json({ success: true, ...(await receiptService.listReceipts(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST — Sales, Manager, Employer
router.post('/', authorizeFunction('sales', 'manager'), [
    body('items').isArray({ min: 1 }).withMessage('At least one item'),
    body('paymentMethod').isIn(['cash', 'card', 'bank_transfer', 'mobile_money', 'credit', 'mixed']),
    body('storeLocation').notEmpty().withMessage('Store location required')
], validate, async (req, res, next) => {
    try { res.status(201).json({ success: true, receipt: await receiptService.createReceipt(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /:id/confirm-payment — Cashier, Manager, Employer
router.put('/:id/confirm-payment', authorizeFunction('cashier', 'manager'), async (req, res, next) => {
    try { res.json({ success: true, receipt: await receiptService.confirmPayment(req, req.params.id, req.body.notes) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /:id/dispute-payment — Cashier, Manager, Employer
router.put('/:id/dispute-payment', authorizeFunction('cashier', 'manager'), [
    body('reason').notEmpty().withMessage('Reason required')
], validate, async (req, res, next) => {
    try { res.json({ success: true, receipt: await receiptService.disputePayment(req, req.params.id, req.body.reason) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /:id/cancel — Sales, Manager, Employer
router.put('/:id/cancel', authorizeFunction('sales', 'manager'), [
    body('reason').notEmpty()
], validate, async (req, res, next) => {
    try { res.json({ success: true, receipt: await receiptService.cancelReceipt(req, req.params.id, req.body.reason) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /price-approval/:approvalId/approve — Manager, Employer
router.put('/price-approval/:approvalId/approve', authorizeFunction('manager'), async (req, res, next) => {
    try { res.json({ success: true, approval: await receiptService.approveBelowPrice(req, req.params.approvalId) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;