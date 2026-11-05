const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Applicant = require('../../models/Applicant');
const Company = require('../../models/company');
const { protect, authorize } = require('../../middleware/auth');
const { aiLimiter } = require('../../middleware/ratelimiter');
const aiService = require('../../services/aiService');
const auditHelper = require('../../utils/auditHelper');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 4 } });

const router = express.Router();
const safeError = (res, err) => err.status ? res.status(err.status).json({ success: false, error: err.message }) : null;

router.post('/:companyId', aiLimiter, upload.array('documents', 4), [
    body('fullName').trim().isLength({ min: 2, max: 120 }),
    body('email').isEmail().normalizeEmail(),
    body('position').trim().isLength({ min: 2, max: 120 }),
    body('resumeText').optional({ checkFalsy: true }).trim().isLength({ min: 30, max: 12000 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Provide valid applicant details. Resume text or readable supported documents are required.' });
    if (!mongoose.isValidObjectId(req.params.companyId)) return res.status(404).json({ success: false, error: 'Company not found' });
    try {
        const company = await Company.findOne({ _id: req.params.companyId, isActive: true }).select('_id');
        if (!company) return res.status(404).json({ success: false, error: 'Company not found' });
        const docs = [];
        let extracted = String(req.body.resumeText || '').trim();
        for (const file of req.files || []) {
            const ext = file.originalname.toLowerCase().split('.').pop();
            let text = '';
            if (ext === 'pdf' && file.mimetype === 'application/pdf' && file.buffer.subarray(0, 5).toString() === '%PDF-') {
                const { PDFParse } = await import('pdf-parse');
                const parser = new PDFParse({ data: file.buffer });
                try { text = (await parser.getText()).text || ''; } finally { await parser.destroy(); }
            } else if (ext === 'docx' && file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && file.buffer.subarray(0, 2).toString() === 'PK') {
                const mammoth = require('mammoth');
                text = (await mammoth.extractRawText({ buffer: file.buffer })).value || '';
            } else if (ext === 'txt' && file.mimetype === 'text/plain' && !file.buffer.includes(0)) {
                text = file.buffer.toString('utf8');
            } else {
                return res.status(400).json({ success: false, error: `Unsupported or invalid document: ${file.originalname}` });
            }
            docs.push({ name: String(file.originalname).replace(/[\r\n]/g, '').slice(0, 120), url: '' });
            extracted += `\n\n[Extracted from ${file.originalname}]\n${text}`;
        }
        extracted = extracted.slice(0, 12000);
        if (extracted.trim().length < 30) return res.status(400).json({ success: false, error: 'Resume text or supported uploaded documents must contain at least 30 readable characters.' });
        const application = await Applicant.create({ company: company._id, fullName: req.body.fullName, email: req.body.email, phone: String(req.body.phone || '').slice(0, 40), position: req.body.position, resumeText: extracted, documents: docs });
        res.status(201).json({ success: true, applicationId: application._id, message: 'Application submitted for employer review.' });
    } catch (err) { res.status(500).json({ success: false, error: 'Unable to submit application' }); }
});

router.get('/', protect, authorize('employer'), async (req, res, next) => {
    try { res.json({ success: true, applicants: await Applicant.find({ company: req.user.company }).select('-resumeText').sort({ createdAt: -1 }).limit(300) }); }
    catch (err) { next(err); }
});

router.get('/:id', protect, authorize('employer'), async (req,res,next)=>{
    try { const applicant=await Applicant.findOne({_id:req.params.id,company:req.user.company});if(!applicant)return res.status(404).json({success:false,error:'Applicant not found'});res.json({success:true,applicant}); }
    catch(err){next(err);}
});

router.post('/:id/analyze', protect, authorize('employer'), aiLimiter, async (req, res, next) => {
    try {
        const applicant = await Applicant.findOne({ _id: req.params.id, company: req.user.company });
        if (!applicant) return res.status(404).json({ success: false, error: 'Applicant not found' });
        const result = await aiService.assessApplicant(req, applicant);
        applicant.aiRecommendation = result;
        await applicant.save();
        await auditHelper.log(req, { action: 'APPLICANT_AI_REVIEW', entityType: 'Applicant', entityId: applicant._id, entityName: applicant.fullName });
        res.json({ success: true, recommendation: result });
    } catch (err) { if (safeError(res, err)) return; next(err); }
});

router.put('/:id/status', protect, authorize('employer'), [body('status').isIn(['reviewed', 'shortlisted', 'rejected', 'hired'])], async (req, res, next) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Invalid status' });
    try {
        const applicant = await Applicant.findOneAndUpdate({ _id: req.params.id, company: req.user.company }, { $set: { status: req.body.status, reviewedBy: req.user._id, reviewedAt: new Date() } }, { new: true });
        if (!applicant) return res.status(404).json({ success: false, error: 'Applicant not found' });
        await auditHelper.log(req, { action: 'APPLICANT_STATUS_UPDATE', entityType: 'Applicant', entityId: applicant._id, entityName: applicant.fullName });
        res.json({ success: true, applicant });
    } catch (err) { next(err); }
});

module.exports = router;
