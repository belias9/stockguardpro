const express = require('express');
const { body, validationResult } = require('express-validator');
const CompanyPolicy = require('../../models/CompanyPolicy');
const { protect, authorize } = require('../../middleware/auth');
const auditHelper = require('../../utils/auditHelper');
const multer = require('multer');

const router = express.Router();
router.use(protect);
const validDocumentUrl = value => !value || /^https:\/\//i.test(value) || /^\/uploads\/[A-Za-z0-9_./-]+$/.test(value);
const documentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');

router.get('/', async (req, res, next) => {
    try {
        const policies = await CompanyPolicy.find({ company: req.user.company, active: true }).select('-acknowledgments.ipAddress -acknowledgments.userAgent');
        const result = policies.map(p => {
            const acknowledged = p.acknowledgments.some(a => String(a.employee) === String(req.user._id) && a.version === p.version);
            const item = p.toObject();
            delete item.acknowledgments;
            return { ...item, hasFile: !!p.fileName, acknowledged };
        });
        res.json({ success: true, policies: result });
    } catch (err) { next(err); }
});

router.post('/upload', authorize('employer'), (req, res, next) => documentUpload(req,res,err=>err?res.status(400).json({success:false,error:'Document upload failed or exceeded 5 MB'}):next()), async (req, res, next) => {
    try {
        const { title, body, kind = 'certificate', requiresAcknowledgment } = req.body;
        if (!title || String(title).length > 160 || !['policy','regulation','certificate'].includes(kind) || !req.file) return res.status(400).json({ success: false, error: 'Provide a title, supported type, and a PDF/JPEG/PNG file' });
        const f=req.file; const signature=f.buffer.subarray(0,8);
        const valid=(f.mimetype==='application/pdf'&&f.originalname.toLowerCase().endsWith('.pdf')&&signature.subarray(0,5).toString()==='%PDF-') || (f.mimetype==='image/png'&&signature.toString('hex')==='89504e470d0a1a0a') || (f.mimetype==='image/jpeg'&&signature[0]===0xff&&signature[1]===0xd8&&signature[2]===0xff);
        if (!valid) return res.status(400).json({ success: false, error: 'File content does not match an allowed PDF, JPEG, or PNG type' });
        const policy=await CompanyPolicy.create({ company:req.user.company,title:String(title).trim(),body:String(body||'Uploaded company document').slice(0,20000),kind,fileName:String(f.originalname).replace(/[\\/\r\n]/g,'_').slice(0,180),contentType:f.mimetype,fileData:f.buffer,requiresAcknowledgment:requiresAcknowledgment==='true',createdBy:req.user._id });
        await auditHelper.log(req,{action:'COMPANY_DOCUMENT_UPLOADED',entityType:'CompanyPolicy',entityId:policy._id,entityName:policy.title});
        res.status(201).json({success:true,policy:{id:policy._id,title:policy.title,kind:policy.kind,fileName:policy.fileName}});
    } catch(err){next(err);}
});

router.get('/:id/file', async (req,res,next)=>{
    try {
        const policy=await CompanyPolicy.findOne({_id:req.params.id,company:req.user.company,active:true}).select('+fileData fileName contentType');
        if(!policy?.fileData)return res.status(404).json({success:false,error:'Document file not found'});
        const filename=policy.fileName.replace(/[^A-Za-z0-9._-]/g,'_');
        res.set('Content-Type',policy.contentType).set('Content-Disposition',`attachment; filename="${filename}"`).set('X-Content-Type-Options','nosniff').send(policy.fileData);
    }catch(err){next(err);}
});

router.post('/', authorize('employer'), [body('title').trim().isLength({ min: 2, max: 160 }), body('body').trim().isLength({ min: 10, max: 20000 }), body('kind').optional().isIn(['policy', 'regulation', 'certificate'])], async (req, res, next) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Enter a title and document text.' });
    try {
        if (!validDocumentUrl(req.body.documentUrl)) return res.status(400).json({ success: false, error: 'Document URL must use HTTPS or an application upload path.' });
        const policy = await CompanyPolicy.create({ company: req.user.company, title: req.body.title, body: req.body.body, kind: req.body.kind || 'policy', documentUrl: String(req.body.documentUrl || '').slice(0, 1200), requiresAcknowledgment: req.body.requiresAcknowledgment !== false, createdBy: req.user._id });
        await auditHelper.log(req, { action: 'POLICY_CREATED', entityType: 'CompanyPolicy', entityId: policy._id, entityName: policy.title });
        res.status(201).json({ success: true, policy });
    } catch (err) { next(err); }
});

router.post('/:id/acknowledge', async (req, res, next) => {
    try {
        const policy = await CompanyPolicy.findOne({ _id: req.params.id, company: req.user.company, active: true });
        if (!policy) return res.status(404).json({ success: false, error: 'Policy not found' });
        if (!policy.requiresAcknowledgment) return res.status(400).json({ success: false, error: 'Acknowledgment is not required' });
        const exists = policy.acknowledgments.some(a => String(a.employee) === String(req.user._id) && a.version === policy.version);
        if (!exists) policy.acknowledgments.push({ employee: req.user._id, version: policy.version, ipAddress: req.ip, userAgent: String(req.get('user-agent') || '').slice(0, 300) });
        await policy.save();
        await auditHelper.log(req, { action: 'POLICY_ACKNOWLEDGED', entityType: 'CompanyPolicy', entityId: policy._id, entityName: policy.title });
        res.json({ success: true, acknowledged: true, acknowledgedAt: policy.acknowledgments[policy.acknowledgments.length - 1].acknowledgedAt, note: 'Recorded as an authenticated electronic acknowledgment, not a biometric or legal signature.' });
    } catch (err) { next(err); }
});

router.put('/:id', authorize('employer'), async (req, res, next) => {
    try {
        const policy = await CompanyPolicy.findOne({ _id: req.params.id, company: req.user.company, active: true });
        if (!policy) return res.status(404).json({ success: false, error: 'Document not found' });
        if (req.body.title !== undefined) policy.title = String(req.body.title).slice(0, 160);
        if (req.body.body !== undefined && req.body.body !== policy.body) { policy.body = String(req.body.body).slice(0, 20000); policy.version += 1; }
        if (req.body.documentUrl !== undefined && !validDocumentUrl(req.body.documentUrl)) return res.status(400).json({ success: false, error: 'Document URL must use HTTPS or an application upload path.' });
        if (req.body.documentUrl !== undefined) policy.documentUrl = String(req.body.documentUrl).slice(0, 1200);
        if (req.body.active === false) policy.active = false;
        await policy.save();
        await auditHelper.log(req, { action: 'POLICY_UPDATED', entityType: 'CompanyPolicy', entityId: policy._id, entityName: policy.title });
        res.json({ success: true, policy });
    } catch (err) { next(err); }
});

module.exports = router;
