/**
 * Auth Routes
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authService = require('../../services/authService');
const { authLimiter } = require('../../middleware/rateLimiter');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg, fields: errors.array() });
    }
    next();
};

// ============================================================
// POST /api/auth/company/login
// ============================================================
router.post('/company/login', authLimiter, [
    body('name').trim().notEmpty().withMessage('Company name required'),
    body('password').notEmpty().withMessage('Password required')
], validate, async (req, res, next) => {
    try {
        const result = await authService.companyLogin(req, req.body);
        res.json({ success: true, ...result });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

// ============================================================
// POST /api/auth/user/login
// ============================================================
router.post('/user/login', authLimiter, [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    body('companyId').notEmpty().withMessage('Company ID required')
], validate, async (req, res, next) => {
    try {
        const result = await authService.userLogin(req, req.body);
        res.json({ success: true, ...result });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

// ============================================================
// POST /api/auth/refresh
// ============================================================
router.post('/refresh', [
    body('refreshToken').notEmpty().withMessage('Refresh token required')
], validate, async (req, res, next) => {
    try {
        const tokens = await authService.refreshToken(req, req.body.refreshToken);
        res.json({ success: true, ...tokens });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

// ============================================================
// POST /api/auth/register-company
// ============================================================
router.post('/register-company', authLimiter, [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Company name 2-100 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phone').notEmpty().withMessage('Phone required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], validate, async (req, res, next) => {
    try {
        const result = await authService.registerCompany(req, req.body);
        res.status(201).json({ success: true, ...result });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

// ============================================================
// POST /api/auth/fingerprint/verify (public — device-only)
// ============================================================
router.post('/fingerprint/verify', [
    body('fingerprintTemplate').notEmpty(),
    body('deviceId').notEmpty(),
    body('companyId').notEmpty(),
    body('employeeId').notEmpty()
], validate, async (req, res, next) => {
    try {
        const result = await authService.fingerprintVerify(req, req.body);
        res.json({ success: true, ...result });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        next(err);
    }
});

module.exports = router;