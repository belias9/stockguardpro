/**
 * User Routes — Employer only
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../../middleware/auth');
const userService = require('../../services/userService');

router.use(protect, authorize('employer'));

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg, fields: errors.array() });
    }
    next();
};

router.get('/', async (req, res, next) => {
    try { res.json({ success: true, ...(await userService.listUsers(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/:id', async (req, res, next) => {
    try { res.json({ success: true, user: await userService.getUser(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/', [
    body('firstName').trim().notEmpty().withMessage('First name required'),
    body('lastName').trim().notEmpty().withMessage('Last name required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phone').notEmpty().withMessage('Phone required'),
    body('password').isLength({ min: 8 }).withMessage('Password min 8 chars'),
    body('role').isIn(['employer', 'employee']).withMessage('Invalid role')
], validate, async (req, res, next) => {
    try { res.status(201).json({ success: true, user: await userService.createUser(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id', async (req, res, next) => {
    try { res.json({ success: true, user: await userService.updateUser(req, req.params.id, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id/close-account', [
    body('reason').notEmpty().withMessage('Reason required')
], validate, async (req, res, next) => {
    try { res.json({ success: true, user: await userService.closeAccount(req, req.params.id, req.body.reason) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.put('/:id/reopen-account', async (req, res, next) => {
    try { res.json({ success: true, user: await userService.reopenAccount(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.delete('/:id', async (req, res, next) => {
    try { res.json({ success: true, user: await userService.deactivateUser(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/:id/reset-password', [
    body('newPassword').isLength({ min: 8 }).withMessage('Password min 8 chars')
], validate, async (req, res, next) => {
    try { res.json({ success: true, ...(await userService.resetPassword(req, req.params.id, req.body.newPassword)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;