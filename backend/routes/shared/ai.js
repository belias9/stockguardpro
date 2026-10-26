const express = require('express');
const router = express.Router();
const { protect, authorize, authorizeFunction } = require('../../middleware/auth');
const { aiLimiter } = require('../../middleware/rateLimiter');
const aiService = require('../../services/aiService');
const Inventory = require('../../models/Inventory');

router.use(protect);

// POST /api/ai/insights — Employer
router.post('/insights', aiLimiter, authorize('employer'), async (req, res, next) => {
    try {
        const result = await aiService.generateInsights(req, req.body.companyData || {});
        res.json({ success: true, ...result });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST /api/ai/stock-query — Employee
router.post('/stock-query', aiLimiter, async (req, res, next) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ success: false, error: 'Query required' });

        // Scope inventory to user's branch
        const branchFilter = req.user.role === 'employer' ? {} : { branch: req.user.branch };
        const items = await Inventory.find({
            company: req.user.company,
            isActive: true,
            ...branchFilter
        }).select('name itemCode quantity unit location minStockLevel reorderPoint sellingPrice');

        const result = await aiService.processStockQuery(req, query, items);
        res.json({ success: true, result });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST /api/ai/assist-input — Stock
router.post('/assist-input', aiLimiter, authorizeFunction('stock', 'manager'), async (req, res, next) => {
    try {
        const { inputData } = req.body;
        const existing = await Inventory.find({ company: req.user.company, isActive: true }).select('name itemCode category');
        const result = await aiService.assistStockInput(req, inputData, existing);
        res.json({ success: true, assistance: result });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST /api/ai/voice-command
router.post('/voice-command', aiLimiter, async (req, res, next) => {
    try {
        const { transcript } = req.body;
        if (!transcript) return res.status(400).json({ success: false, error: 'Transcript required' });
        const result = await aiService.processVoiceCommand(req, transcript);
        res.json({ success: true, command: result });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST /api/ai/predict — Employer/Manager
router.post('/predict', aiLimiter, authorizeFunction('manager'), async (req, res, next) => {
    try {
        const { historicalData } = req.body;
        const result = await aiService.predictInventory(req, historicalData || []);
        res.json({ success: true, predictions: result });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST /api/ai/report — Employer
router.post('/report', aiLimiter, authorize('employer'), async (req, res, next) => {
    try {
        const { reportType, data, period } = req.body;
        const report = await aiService.generateReport(req, reportType, data, period);
        res.json({ success: true, report });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// GET /api/ai/status
router.get('/status', (req, res) => {
    res.json({
        success: true,
        configured: aiService.isConfigured(),
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        message: aiService.isConfigured() ? 'AI is active' : 'AI not configured — add OPENAI_API_KEY to .env'
    });
});

module.exports = router;