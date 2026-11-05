const express = require('express');
const { protect, authorize } = require('../../middleware/auth');
const service = require('../../services/endOfDayService');
const Company = require('../../models/company');
const router = express.Router();

router.use(protect);
router.get('/', async (req, res, next) => {
    try {
        const isEmployer = req.user.role === 'employer';
        const isManager = req.user.role === 'employee' && req.user.activeRoles?.includes('manager');
        if (!isEmployer && !isManager) return res.status(403).json({ success: false, error: 'End-of-day reports are available to employers and branch managers' });
        const reports = await service.listReports(req, req.query);
        if (isEmployer) return res.json({ success: true, reports: reports.map(r => r.toPublicJSON()) });

        const company = await Company.findById(req.user.company).select('settings.endOfDayManagerSections');
        const allowed = company?.settings?.endOfDayManagerSections || [];
        const managerReports = reports.map(report => {
            const full = report.toPublicJSON();
            const safe = { id: full.id, date: full.date, reportDate: full.reportDate, branch: full.branch, delivery: full.delivery, locked: full.locked, createdAt: full.createdAt };
            for (const section of allowed) {
                if (!full[section]) continue;
                safe[section] = full[section];
            }
            if (safe.cashier) {
                const { totalCost, totalProfit, profitMargin, ...cashier } = safe.cashier;
                safe.cashier = { ...cashier, perCashier: (cashier.perCashier || []).map(({ totalProfit: _profit, ...row }) => row) };
            }
            return safe;
        });
        res.json({ success: true, reports: managerReports });
    }
    catch (err) { next(err); }
});
router.post('/generate', authorize('employer'), async (req, res, next) => {
    try { const company = await Company.findById(req.user.company); const reports = await service.generateCompanyReports(company); await require('../../models/EndOfDayReport').populate(reports,{path:'branch',select:'name code'}); res.json({ success: true, reports: reports.map(r => r.toPublicJSON()) }); }
    catch (err) { next(err); }
});
module.exports = router;
