const express = require('express');
const router = express.Router();
const { protect, authorize, authorizeFunction } = require('../../middleware/auth');
const { aiLimiter } = require('../../middleware/ratelimiter');
const aiService = require('../../services/aiService');
const Inventory = require('../../models/Inventory');
const dashboardService = require('../../services/dashboardService');
const Receipt = require('../../models/Receipt');
const AccountingEntry = require('../../models/AccountingEntry');

router.use(protect);

// POST /api/ai/insights — Employer
router.post('/insights', aiLimiter, authorize('employer'), async (req, res, next) => {
    try {
        // Never trust caller-supplied totals for business analysis. Build a
        // minimal, tenant-scoped snapshot from current database records.
        const overview = await dashboardService.getOverview(req);
        const companyValue = await dashboardService.getCompanyValueReport(req);
        const receipts = await Receipt.aggregate([
            { $match: { company: req.user.company, status: { $nin: ['cancelled', 'refunded'] }, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
            { $group: { _id: null, count: { $sum: 1 }, sales: { $sum: '$totalAmount' }, paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'confirmed'] }, '$totalAmount', 0] } } } }
        ]);
        const accounting = await AccountingEntry.aggregate([
            { $match: { company: req.user.company, status: 'approved', date: { $gte: new Date(Date.now() - 30 * 86400000) } } },
            { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);
        const result = await aiService.generateInsights(req, {
            ...overview.overview,
            companyValue: companyValue.inventory,
            receiptsLast30Days: receipts[0] || { count: 0, sales: 0, paid: 0 },
            approvedAccountingLast30Days: accounting
        });
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
        const Inventory = require('../../models/Inventory');
        const match = { company: req.user.company, isActive: true };
        if (req.user.role !== 'employer') match.branch = req.user.branch;
        else if (req.branch) match.branch = req.branch;
        const stock = await Inventory.find(match).select('name quantity category').limit(1000).lean();
        const since = new Date(Date.now() - 90 * 86400000);
        const usage = await Receipt.aggregate([
            { $match: { company: req.user.company, status: 'finalized', createdAt: { $gte: since }, ...(match.branch ? { branch: match.branch } : {}) } },
            { $unwind: '$items' },
            { $group: { _id: '$items.inventoryItem', quantity: { $sum: '$items.quantity' } } }
        ]);
        const usageByItem = new Map(usage.map(row => [String(row._id), row.quantity]));
        const historicalData = stock.map(item => ({ name: item.name, category: item.category, currentStock: item.quantity, monthlyUsage: Math.round(((usageByItem.get(String(item._id)) || 0) / 3) * 100) / 100 }));
        const result = await aiService.predictInventory(req, historicalData);
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
