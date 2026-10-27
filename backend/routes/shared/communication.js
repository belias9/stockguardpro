const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect } = require('../../middleware/auth');
const Communication = require('../../models/Communication');
const User = require('../../models/User');
const auditHelper = require('../../utils/auditHelper');
const { v4: uuidv4 } = require('uuid');

router.use(protect);

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
    next();
};

router.get('/inbox', async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = { company: req.user.company, recipient: req.user._id, ...(status && { status }) };
        const messages = await Communication.find(query)
            .populate('sender', 'firstName lastName role')
            .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
        const total = await Communication.countDocuments(query);
        const unreadCount = await Communication.countDocuments({ ...query, status: 'unread' });
        res.json({ success: true, messages, total, unreadCount, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) { next(err); }
});

router.get('/sent', async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = { company: req.user.company, sender: req.user._id };
        const messages = await Communication.find(query)
            .populate('recipient', 'firstName lastName role')
            .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
        const total = await Communication.countDocuments(query);
        res.json({ success: true, messages, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) { next(err); }
});

router.get('/recipients', async (req, res, next) => {
    try {
        const recipients = await User.find({
            company: req.user.company,
            _id: { $ne: req.user._id },
            isActive: true,
            accountClosed: false
        }).select('firstName lastName role activeRoles');
        res.json({ success: true, recipients });
    } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
    try {
        const message = await Communication.findOne({ _id: req.params.id, company: req.user.company })
            .populate('sender', 'firstName lastName role')
            .populate('recipient', 'firstName lastName role');
        if (!message) return res.status(404).json({ success: false, error: 'Not found' });
        if (message.recipient.toString() === req.user._id.toString() && message.status === 'unread') {
            message.status = 'read'; message.readAt = new Date(); await message.save();
        }
        res.json({ success: true, message });
    } catch (err) { next(err); }
});

router.post('/', [
    body('recipientId').notEmpty(),
    body('type').isIn(['complaint','request','general','urgent','feedback','salary_dispute','leave_request']),
    body('subject').notEmpty(),
    body('message').notEmpty()
], validate, async (req, res, next) => {
    try {
        const { recipientId, type, subject, message, priority } = req.body;
        const recipient = await User.findOne({ _id: recipientId, company: req.user.company });
        if (!recipient) return res.status(404).json({ success: false, error: 'Recipient not found' });
        const comm = await Communication.create({
            company: req.user.company, branch: req.user.branch,
            threadId: uuidv4(),
            sender: req.user._id, senderName: `${req.user.firstName} ${req.user.lastName}`, senderRole: req.user.role,
            recipient: recipientId, recipientName: `${recipient.firstName} ${recipient.lastName}`,
            type, subject, message, priority: priority || 'normal'
        });
        await auditHelper.log(req, { action: 'MESSAGE_SEND', entityType: 'Communication', entityId: comm._id, entityName: subject });
        res.status(201).json({ success: true, communication: comm });
    } catch (err) { next(err); }
});

router.post('/:id/respond', [body('message').notEmpty()], validate, async (req, res, next) => {
    try {
        const comm = await Communication.findOne({ _id: req.params.id, company: req.user.company });
        if (!comm) return res.status(404).json({ success: false, error: 'Not found' });
        comm.responses.push({
            responder: req.user._id,
            responderName: `${req.user.firstName} ${req.user.lastName}`,
            responderRole: req.user.role,
            message: req.body.message,
            timestamp: new Date()
        });
        if (comm.recipient.toString() === req.user._id.toString()) comm.status = 'in_progress';
        await comm.save();
        res.json({ success: true, communication: comm });
    } catch (err) { next(err); }
});

router.put('/:id/resolve', async (req, res, next) => {
    try {
        const comm = await Communication.findOne({ _id: req.params.id, company: req.user.company });
        if (!comm) return res.status(404).json({ success: false, error: 'Not found' });
        comm.status = 'resolved';
        comm.resolution = { resolvedAt: new Date(), resolvedBy: req.user._id, resolution: req.body.resolution || 'Resolved' };
        await comm.save();
        res.json({ success: true, communication: comm });
    } catch (err) { next(err); }
});

module.exports = router;
