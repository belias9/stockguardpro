const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, authorize } = require('../../middleware/auth');
const Company = require('../../models/Company');
const Customization = require('../../models/Customization');

router.use(protect, authorize('employer'));

const uploadDir = path.join(__dirname, '../../uploads/logos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${req.user.company}_${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/png', 'image/svg+xml'].includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only JPEG/PNG/SVG allowed'));
    }
});

router.post('/upload', upload.single('logo'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
        const url = `/uploads/logos/${req.file.filename}`;
        
        const custom = await Customization.getForCompany(req.user.company);
        custom.receiptTemplate.logoUrl = url;
        await custom.save();
        
        res.json({ success: true, logoUrl: url });
    } catch (err) { next(err); }
});

// Auto-generate a simple letter-based logo
router.post('/generate', async (req, res, next) => {
    try {
        const company = await Company.findById(req.user.company);
        const initial = (company.name || 'S').charAt(0).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
            <rect width="200" height="200" fill="#2563eb" rx="20"/>
            <text x="100" y="130" font-family="Arial, sans-serif" font-size="100" font-weight="bold" fill="white" text-anchor="middle">${initial}</text>
        </svg>`;
        const filename = `${req.user.company}_auto_${Date.now()}.svg`;
        fs.writeFileSync(path.join(uploadDir, filename), svg);
        const url = `/uploads/logos/${filename}`;
        
        const custom = await Customization.getForCompany(req.user.company);
        custom.receiptTemplate.logoUrl = url;
        await custom.save();
        
        res.json({ success: true, logoUrl: url });
    } catch (err) { next(err); }
});

module.exports = router;
