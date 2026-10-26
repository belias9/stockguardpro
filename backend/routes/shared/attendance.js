const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../../middleware/auth');
const attendanceService = require('../../services/attendanceService');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
    next();
};

// Public — clock in/out (device-auth)
router.post('/clock-in', [
    body('employeeId').notEmpty(),
    body('companyId').notEmpty(),
    body('deviceId').notEmpty()
], validate, async (req, res, next) => {
    try { res.json({ success: true, ...(await attendanceService.clockIn(req, req.body)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/clock-out', [
    body('employeeId').notEmpty(),
    body('companyId').notEmpty(),
    body('deviceId').notEmpty()
], validate, async (req, res, next) => {
    try { res.json({ success: true, ...(await attendanceService.clockOut(req, req.body)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// Protected — everything else
router.get('/today', protect, authorize('employer'), async (req, res, next) => {
    try { res.json({ success: true, ...(await attendanceService.getToday(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/employee/:employeeId', protect, async (req, res, next) => {
    try { res.json({ success: true, ...(await attendanceService.getEmployeeAttendance(req, req.params.employeeId, req.query)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/absence-reason', protect, [
    body('date').notEmpty(),
    body('reason').notEmpty()
], validate, async (req, res, next) => {
    try { res.json({ success: true, attendance: await attendanceService.submitAbsenceReason(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;