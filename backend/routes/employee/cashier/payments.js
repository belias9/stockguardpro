/**
 * Cashier Routes
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorizeFunction } = require('../../../middleware/auth');
const cashierService = require('../../../services/cashierService');

router.use(protect, authorizeFunction('cashier', 'manager'));

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    next();
};

// GET /api/cashier/session — current session
router.get('/session', async (req, res, next) => {
    try { res.json({ success: true, session: await cashierService.getCurrentSession(req) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// GET /api/cashier/pending — receipts awaiting confirmation
router.get('/pending', async (req, res, next) => {
    try { res.json({ success: true, receipts: await cashierService.getPendingReceipts(req) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST /api/cashier/confirm/:receiptId — confirm payment
router.post('/confirm/:receiptId', async (req, res, next) => {
    try { res.json({ success: true, ...(await cashierService.confirmPayment(req, req.params.receiptId, req.body.notes)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST /api/cashier/dispute/:receiptId — dispute payment
router.post('/dispute/:receiptId', [
    body('reason').notEmpty().withMessage('Reason required')
], validate, async (req, res, next) => {
    try { res.json({ success: true, receipt: await cashierService.disputePayment(req, req.params.receiptId, req.body.reason) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// GET /api/cashier/report?date=YYYY-MM-DD — daily report
router.get('/report', async (req, res, next) => {
    try { res.json({ success: true, report: await cashierService.getDailyReport(req, req.query.date) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST /api/cashier/close — close session
router.post('/close', async (req, res, next) => {
    try { res.json({ success: true, session: await cashierService.closeSession(req, req.body.notes) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// GET /api/cashier/sessions — list all (manager/employer view includes profit)
router.get('/sessions', authorizeFunction('manager'), async (req, res, next) => {
    try { res.json({ success: true, ...(await cashierService.listSessions(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;