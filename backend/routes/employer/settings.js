const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../../middleware/auth');
const customizationService = require('../../services/customizationService');

router.use(protect, authorize('employer'));

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
    next();
};

router.get('/', async (req, res, next) => {
    try { res.json({ success: true, customization: await customizationService.getCustomization(req) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// Categories
router.post('/categories', [body('name').notEmpty()], validate, async (req, res, next) => {
    try { res.json({ success: true, customization: await customizationService.addCategory(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.delete('/categories/:slug', async (req, res, next) => {
    try { res.json({ success: true, customization: await customizationService.removeCategory(req, req.params.slug) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// Units
router.post('/units', [body('name').notEmpty()], validate, async (req, res, next) => {
    try { res.json({ success: true, customization: await customizationService.addUnit(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.delete('/units/:name', async (req, res, next) => {
    try { res.json({ success: true, customization: await customizationService.removeUnit(req, req.params.name) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// Custom fields
router.post('/fields', [body('key').notEmpty(), body('label').notEmpty()], validate, async (req, res, next) => {
    try { res.json({ success: true, customization: await customizationService.addCustomField(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.delete('/fields/:key', async (req, res, next) => {
    try { res.json({ success: true, customization: await customizationService.removeCustomField(req, req.params.key) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// Currency
router.put('/currency', async (req, res, next) => {
    try { res.json({ success: true, customization: await customizationService.updateCurrency(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// Receipt template
router.put('/receipt-template', async (req, res, next) => {
    try { res.json({ success: true, customization: await customizationService.updateReceiptTemplate(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;