const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');
const dashboardService = require('../../services/dashboardService');

router.use(protect);

router.get('/overview', async (req, res, next) => {
    try { res.json({ success: true, overview: await dashboardService.getOverview(req) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/employee-dashboard', async (req, res, next) => {
    try {
        if (req.user.role !== 'employee') {
            return res.status(403).json({ success: false, error: 'Employee only' });
        }
        res.json({ success: true, ...(await dashboardService.getEmployeeDashboard(req)) });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/structure-value', async (req, res, next) => {
    try { res.json({ success: true, ...(await dashboardService.getStructureValueReport(req, req.query)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/company-value', async (req, res, next) => {
    try { res.json({ success: true, ...(await dashboardService.getCompanyValueReport(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;