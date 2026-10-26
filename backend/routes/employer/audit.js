/**
 * Audit Routes — Employer only
 */
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const { exportLimiter } = require('../../middleware/rateLimiter');
const auditService = require('../../services/auditService');

router.use(protect, authorize('employer'));

router.get('/', async (req, res, next) => {
    try { res.json({ success: true, ...(await auditService.listLogs(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/summary', async (req, res, next) => {
    try { res.json({ success: true, ...(await auditService.getSummary(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/export', exportLimiter, async (req, res, next) => {
    try {
        const data = await auditService.exportLogs(req);

        // CSV output
        if (req.query.format === 'csv') {
            const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity Name', 'User', 'Role', 'Severity', 'Success', 'Error'];
            const rows = data.map(l => [
                l.timestamp, l.action, l.entityType, l.entityName,
                l.performedByName, l.performedByRole, l.severity,
                l.success ? 'true' : 'false', l.errorMessage
            ]);
            const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="audit-${new Date().toISOString().split('T')[0]}.csv"`);
            return res.send(csv);
        }

        res.json({ success: true, data, total: data.length });
    } catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/user/:userId', async (req, res, next) => {
    try { res.json({ success: true, ...(await auditService.getUserLogs(req, req.params.userId)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.get('/:id', async (req, res, next) => {
    try { res.json({ success: true, log: await auditService.getLog(req, req.params.id) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

module.exports = router;