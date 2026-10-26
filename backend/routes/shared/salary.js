const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect } = require('../../middleware/auth');
const salaryService = require('../../services/salaryService');

router.use(protect);
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
    next();
};

router.get('/', async (req, res, next) => {
    try { res.json({ success: true, ...(await salaryService.listSalaries(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/generate', [
    body('month').isInt({ min: 1, max: 12 }),
    body('year').isInt({ min: 2020 })
], validate, async (req, res, next) => {
    try { res.json({ success: true, ...(await salaryService.generateSalaries(req, req.body)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id/pay', async (req, res, next) => {
    try { res.json({ success: true, salary: await salaryService.paySalary(req, req.params.id, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/:id/bonus', [
    body('amount').isNumeric(),
    body('reason').notEmpty()
], validate, async (req, res, next) => {
    try { res.json({ success: true, salary: await salaryService.addBonus(req, req.params.id, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id/bonus-approval', async (req, res, next) => {
    try { res.json({ success: true, salary: await salaryService.approveBonus(req, req.params.id, req.body.approved) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/advance', [
    body('amount').isNumeric(),
    body('reason').optional()
], validate, async (req, res, next) => {
    try { res.json({ success: true, ...(await salaryService.requestAdvance(req, req.body)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id/advance', async (req, res, next) => {
    try { res.json({ success: true, salary: await salaryService.approveAdvance(req, req.params.id, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/:id/dispute', [
    body('issue').notEmpty()
], validate, async (req, res, next) => {
    try { res.json({ success: true, salary: await salaryService.submitDispute(req, req.params.id, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id/dispute/:disputeIndex', async (req, res, next) => {
    try { res.json({ success: true, salary: await salaryService.resolveDispute(req, req.params.id, parseInt(req.params.disputeIndex), req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;