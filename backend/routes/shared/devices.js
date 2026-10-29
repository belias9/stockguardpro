const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../../middleware/auth');
const Device = require('../../models/Device');
const auditHelper = require('../../utils/auditHelper');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
    next();
};

// Get current active device for company/branch
router.get('/current', protect, async (req, res, next) => {
    try {
        const branchId = req.user.role === 'employer' ? req.branch : req.user.branch;
        const device = await Device.findActive(req.user.company, branchId);
        res.json({ success: true, device: device ? device.toPublicJSON() : null });
    } catch (err) { next(err); }
});

// Register new device (deactivates old automatically)
router.post('/register', protect, authorize('employer'), [
    body('name').notEmpty(),
    body('deviceId').notEmpty()
], validate, async (req, res, next) => {
    try {
        const { name, deviceId, type = 'phone', assignedTo } = req.body;
        const branchId = req.branch || null;

        // Deactivate all current devices
        await Device.deactivateAll(req.user.company, branchId, req.user._id);

        // Create new device
        const rawApiKey = Device.generateApiKey();
        const device = await Device.create({
            company: req.user.company,
            branch: branchId,
            name,
            deviceId,
            type,
            apiKey: rawApiKey,
            assignedTo: assignedTo || null,
            registeredBy: req.user._id
        });

        await auditHelper.log(req, {
            action: 'DEVICE_REGISTER',
            entityType: 'Device',
            entityId: device._id,
            entityName: device.name
        });

        // Return API key ONCE (client must save it)
        res.status(201).json({
            success: true,
            device: device.toPublicJSON(),
            apiKey: rawApiKey // shown only once
        });
    } catch (err) { next(err); }
});

// Deactivate device
router.delete('/:id', protect, authorize('employer'), async (req, res, next) => {
    try {
        const device = await Device.findOne({ _id: req.params.id, company: req.user.company });
        if (!device) return res.status(404).json({ success: false, error: 'Not found' });
        device.isActive = false;
        device.deactivatedAt = new Date();
        device.deactivatedBy = req.user._id;
        await device.save();
        res.json({ success: true, message: 'Device deactivated' });
    } catch (err) { next(err); }
});

module.exports = router;