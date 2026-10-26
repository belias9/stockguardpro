const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorizeFunction } = require('../../middleware/auth');
const customerService = require('../../services/customerService');

router.use(protect);
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
    next();
};

// Customers
router.get('/', async (req, res, next) => {
    try { res.json({ success: true, ...(await customerService.listCustomers(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/:id', async (req, res, next) => {
    try { res.json({ success: true, customer: await customerService.getCustomer(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/', authorizeFunction('sales', 'manager'), [
    body('name').notEmpty(),
    body('phone').notEmpty()
], validate, async (req, res, next) => {
    try { res.status(201).json({ success: true, customer: await customerService.createCustomer(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id', authorizeFunction('sales', 'manager'), async (req, res, next) => {
    try { res.json({ success: true, customer: await customerService.updateCustomer(req, req.params.id, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/:id/conversation', authorizeFunction('sales', 'manager'), [
    body('type').isIn(['incoming', 'outgoing']),
    body('message').notEmpty()
], validate, async (req, res, next) => {
    try { res.json({ success: true, customer: await customerService.addConversation(req, req.params.id, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// Orders
router.get('/orders/list', authorizeFunction('sales', 'manager'), async (req, res, next) => {
    try { res.json({ success: true, ...(await customerService.listOrders(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/orders', authorizeFunction('sales', 'manager'), [
    body('customerId').notEmpty(),
    body('items').isArray({ min: 1 })
], validate, async (req, res, next) => {
    try { res.status(201).json({ success: true, order: await customerService.createOrder(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/orders/:id/approve', authorizeFunction('manager'), async (req, res, next) => {
    try { res.json({ success: true, order: await customerService.approveOrder(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/orders/:id/reject', authorizeFunction('manager'), [
    body('reason').notEmpty()
], validate, async (req, res, next) => {
    try { res.json({ success: true, order: await customerService.rejectOrder(req, req.params.id, req.body.reason) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;