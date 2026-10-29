const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Company = require('../../models/Company');
const auditHelper = require('../../utils/auditHelper');

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
        const { settings } = req.body;
        const company = await Company.findByIdAndUpdate(req.user.company, {
            settings, updatedAt: Date.now()
        }, { new: true });
        await auditHelper.log(req, { action: 'SETTINGS_UPDATE', entityType: 'Company', entityId: company._id, entityName: company.name });
        res.json({ success: true, company });
    } catch (err) { next(err); }
});

module.exports = router;