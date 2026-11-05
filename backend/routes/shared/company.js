const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Company = require('../../models/company');
const auditHelper = require('../../utils/auditHelper');
const User = require('../../models/User');
const Customization = require('../../models/Customization');

// Company name and logo are non-sensitive tenant branding needed by every
// authenticated role for the application shell.
router.get('/branding', protect, async (req, res, next) => {
    try {
        const [company, customization] = await Promise.all([
            Company.findById(req.user.company).select('name receiptTemplate.logoUrl').lean(),
            Customization.findOne({ company: req.user.company }).select('receiptTemplate.logoUrl').lean()
        ]);
        if (!company) return res.status(404).json({ success: false, error: 'Company not found' });
        res.json({
            success: true,
            branding: {
                companyName: company.name,
                logoUrl: customization?.receiptTemplate?.logoUrl || company.receiptTemplate?.logoUrl || null
            }
        });
    } catch (err) { next(err); }
});

router.use(protect, authorize('employer'));

router.get('/profile', async (req, res, next) => {
    try {
        const company = await Company.findById(req.user.company);
        if (!company) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, company });
    } catch (err) { next(err); }
});

router.put('/profile', async (req, res, next) => {
    try {
        const { name, email, phone, address } = req.body;
        const company = await Company.findByIdAndUpdate(req.user.company, {
            name, email, phone, address, updatedAt: Date.now()
        }, { new: true });
        await auditHelper.log(req, { action: 'UPDATE', entityType: 'Company', entityId: company._id, entityName: company.name });
        res.json({ success: true, company });
    } catch (err) { next(err); }
});

router.put('/settings', async (req, res, next) => {
    try {
        const input = req.body.settings || {};
        const company = await Company.findById(req.user.company);
        if (!company) return res.status(404).json({ success: false, error: 'Company not found' });
        const set = (key, value) => { if (value !== undefined) company.set(`settings.${key}`, value); };
        if (input.workingHours !== undefined) {
            if (!input.workingHours || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.workingHours.start || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.workingHours.end || '')) return res.status(400).json({ success: false, error: 'Working hours must use HH:MM' });
            set('workingHours.start', input.workingHours.start); set('workingHours.end', input.workingHours.end);
        }
        if (input.endOfDayReportTime !== undefined) {
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endOfDayReportTime)) return res.status(400).json({ success: false, error: 'End-of-day report time must use HH:MM' });
            set('endOfDayReportTime', input.endOfDayReportTime);
        }
        if (input.endOfDayManagerSections !== undefined) {
            const allowedSections = ['goodsBought', 'attendance', 'cashier', 'transfers', 'inventoryAlerts', 'faultyGoods', 'aiInsights'];
            if (!Array.isArray(input.endOfDayManagerSections) || input.endOfDayManagerSections.some(section => !allowedSections.includes(section))) {
                return res.status(400).json({ success: false, error: 'Manager end-of-day sections are invalid' });
            }
            set('endOfDayManagerSections', [...new Set(input.endOfDayManagerSections)]);
        }
        for (const key of ['autoDeductAbsence', 'autoDeductLate']) if (input[key] !== undefined) {
            if (typeof input[key] !== 'boolean') return res.status(400).json({ success: false, error: `${key} must be true or false` });
            set(key, input[key]);
        }
        for (const key of ['absenceDeductionRate', 'lateDeductionRate']) if (input[key] !== undefined) {
            const value = Number(input[key]); if (!Number.isFinite(value) || value < 0 || value > 1) return res.status(400).json({ success: false, error: `${key} must be between 0 and 1` }); set(key, value);
        }
        if (input.lateGraceMinutes !== undefined) { const n=Number(input.lateGraceMinutes); if (!Number.isInteger(n)||n<0||n>240) return res.status(400).json({ success:false,error:'Late grace period must be 0 to 240 minutes' }); set('lateGraceMinutes',n); }
        for (const key of ['receiptWhatsAppThreshold', 'advanceManagerLimit', 'advanceMonthlyCap', 'advanceBaseSalaryPercent']) if (input[key] !== undefined) {
            const n=Number(input[key]); if (!Number.isFinite(n)||n<0) return res.status(400).json({ success:false,error:`${key} must be a non-negative number` }); set(key,n);
        }
        await company.save();
        await auditHelper.log(req, { action: 'SETTINGS_UPDATE', entityType: 'Company', entityId: company._id, entityName: company.name });
        res.json({ success: true, company });
    } catch (err) { next(err); }
});

router.get('/governance', async (req, res, next) => {
    try {
        const company = await Company.findById(req.user.company).select('governance primaryEmployer');
        res.json({ success: true, governance: company.governance, isPrimaryEmployer: String(company.primaryEmployer) === String(req.user._id) });
    } catch (err) { next(err); }
});

router.put('/governance', async (req, res, next) => {
    try {
        const company = await Company.findById(req.user.company);
        if (String(company.primaryEmployer) !== String(req.user._id)) return res.status(403).json({ success: false, error: 'Only the primary employer can change ownership governance' });
        const { structure, shareholders } = req.body;
        if (!['private', 'joint_stock'].includes(structure) || !Array.isArray(shareholders) || shareholders.length > 100) return res.status(400).json({ success: false, error: 'Provide a valid company structure and shareholder list' });
        const cleaned = shareholders.map(s => ({ name: String(s.name || '').trim().slice(0,120), email: String(s.email || '').trim().toLowerCase().slice(0,160), shares: Number(s.shares || 0), ownershipPercent: Number(s.ownershipPercent || 0), votingPercent: Number(s.votingPercent ?? s.ownershipPercent ?? 0) }));
        if (cleaned.some(s => !s.name || !Number.isFinite(s.shares) || s.shares < 0 || !Number.isFinite(s.ownershipPercent) || s.ownershipPercent < 0 || s.ownershipPercent > 100 || !Number.isFinite(s.votingPercent) || s.votingPercent < 0 || s.votingPercent > 100)) return res.status(400).json({ success: false, error: 'Shareholder values are invalid' });
        if (cleaned.reduce((total, s) => total + s.ownershipPercent, 0) > 100.01) return res.status(400).json({ success: false, error: 'Shareholder ownership cannot exceed 100%' });
        company.governance = { structure, shareholders: cleaned, updatedBy: req.user._id, updatedAt: new Date() };
        await company.save();
        await auditHelper.log(req, { action: 'COMPANY_GOVERNANCE_UPDATE', entityType: 'Company', entityId: company._id, entityName: company.name });
        res.json({ success: true, governance: company.governance });
    } catch (err) { next(err); }
});

router.get('/employers', async (req, res, next) => {
    try {
        const company = await Company.findById(req.user.company).select('primaryEmployer');
        const employers = await User.find({ company: req.user.company, role: 'employer', isActive: true }).select('firstName lastName email employerPermissions').lean();
        res.json({ success: true, primaryEmployer: company.primaryEmployer, employers: employers.map(e => ({ ...e, isPrimary: String(e._id) === String(company.primaryEmployer) })) });
    } catch (err) { next(err); }
});

router.put('/employers/:id/permissions', async (req, res, next) => {
    try {
        const company = await Company.findById(req.user.company).select('primaryEmployer');
        if (String(company.primaryEmployer) !== String(req.user._id)) return res.status(403).json({ success: false, error: 'Only the primary employer can delegate co-employer access' });
        const allowed = ['governance','people','workforce','accounting','inventory','operations','communications','analytics','administration'];
        const permissions = [...new Set(Array.isArray(req.body.permissions) ? req.body.permissions : [])];
        if (permissions.some(p => !allowed.includes(p))) return res.status(400).json({ success: false, error: 'Unknown employer access scope' });
        const target = await User.findOne({ _id: req.params.id, company: req.user.company, role: 'employer', isActive: true });
        if (!target) return res.status(404).json({ success: false, error: 'Co-employer not found' });
        if (String(target._id) === String(company.primaryEmployer)) return res.status(400).json({ success: false, error: 'Primary employer access cannot be restricted here' });
        target.employerPermissions = permissions; await target.save();
        await auditHelper.log(req, { action: 'CO_EMPLOYER_ACCESS_UPDATE', entityType: 'User', entityId: target._id, entityName: target.fullName, changes: { after: { permissions } } });
        res.json({ success: true, employer: target.toPublicJSON() });
    } catch (err) { next(err); }
});

module.exports = router;
