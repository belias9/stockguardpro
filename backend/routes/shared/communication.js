const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect } = require('../../middleware/auth');
const Communication = require('../../models/Communication');
const User = require('../../models/User');
const { v4: uuidv4 } = require('uuid');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
    next();
};

router.use(protect);

router.get('/inbox', async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = { company: req.user.company, recipient: req.user._id };
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
            isActive: true
        }).select('firstName lastName role activeRoles');
        res.json({ success: true, recipients });
    } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
    try {
        const msg = await Communication.findOne({ _id: req.params.id, company: req.user.company })
            .populate('sender', 'firstName lastName role')
            .populate('recipient', 'firstName lastName role');
        if (!msg) return res.status(404).json({ success: false, error: 'Not found' });
        if (req.user.role !== 'employer' && msg.sender._id.toString() !== req.user._id.toString() && msg.recipient._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, error: 'You cannot access this message' });
        }
        if (msg.recipient.toString() === req.user._id.toString() && msg.status === 'unread') {
            msg.status = 'read';
            msg.readAt = new Date();
            await msg.save();
        }
        res.json({ success: true, message: msg });
    } catch (err) { next(err); }
});

router.post('/', [
    body('recipientId').notEmpty(),
    body('type').isIn(['complaint','request','general','urgent','feedback','salary_dispute','leave_request']),
    body('subject').notEmpty(),
    body('message').notEmpty()
], validate, async (req, res, next) => {
    try {
        const recipient = await User.findOne({ _id: req.body.recipientId, company: req.user.company });
        if (!recipient) return res.status(404).json({ success: false, error: 'Recipient not found' });
        
        const comm = await Communication.create({
            company: req.user.company,
            branch: req.user.branch,
            threadId: uuidv4(),
            sender: req.user._id,
            senderName: `${req.user.firstName} ${req.user.lastName}`,
            senderRole: req.user.role,
            recipient: req.body.recipientId,
            recipientName: `${recipient.firstName} ${recipient.lastName}`,
            type: req.body.type,
            subject: req.body.subject,
            message: req.body.message,
            priority: req.body.priority || 'normal'
        });
        res.status(201).json({ success: true, communication: comm });
    } catch (err) { next(err); }
});

router.post('/:id/respond', [body('message').notEmpty()], validate, async (req, res, next) => {
    try {
        const comm = await Communication.findOne({ _id: req.params.id, company: req.user.company });
        if (!comm) return res.status(404).json({ success: false, error: 'Not found' });
        if (req.user.role !== 'employer' && comm.sender.toString() !== req.user._id.toString() && comm.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, error: 'You cannot reply to this message' });
        }
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
        if (req.user.role !== 'employer' && comm.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, error: 'Only the recipient or employer can resolve this message' });
        }
        comm.status = 'resolved';
        comm.resolution = {
            resolvedAt: new Date(),
            resolvedBy: req.user._id,
            resolution: req.body.resolution || 'Resolved'
        };
        await comm.save();
        res.json({ success: true, communication: comm });
    } catch (err) { next(err); }
});

module.exports = router;
