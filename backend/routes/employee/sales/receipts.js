/**
 * Receipt Routes
 * Sales can create; cashier/manager/employer can confirm.
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorizeFunction } = require('../../../middleware/auth');
const receiptService = require('../../../services/receiptService');
const Receipt = require('../../../models/Receipt');
const Customization = require('../../../models/Customization');
const Company = require('../../../models/Company');
router.use(protect);

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    next();
};

// GET — Sales, Manager, Employer
router.get('/', authorizeFunction('sales', 'manager', 'cashier'), async (req, res, next) => {
    try { res.json({ success: true, ...(await receiptService.listReceipts(req)) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// POST — Sales, Manager, Employer
router.post('/', authorizeFunction('sales', 'manager'), [
    body('items').isArray({ min: 1 }).withMessage('At least one item'),
    body('paymentMethod').isIn(['cash', 'card', 'bank_transfer', 'mobile_money', 'credit', 'mixed']),
    body('storeLocation').notEmpty().withMessage('Store location required')
], validate, async (req, res, next) => {
    try { res.status(201).json({ success: true, receipt: await receiptService.createReceipt(req, req.body) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /:id/confirm-payment — Cashier, Manager, Employer
router.put('/:id/confirm-payment', authorizeFunction('cashier', 'manager'), async (req, res, next) => {
    try { res.json({ success: true, receipt: await receiptService.confirmPayment(req, req.params.id, req.body.notes) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /:id/dispute-payment — Cashier, Manager, Employer
router.put('/:id/dispute-payment', authorizeFunction('cashier', 'manager'), [
    body('reason').notEmpty().withMessage('Reason required')
], validate, async (req, res, next) => {
    try { res.json({ success: true, receipt: await receiptService.disputePayment(req, req.params.id, req.body.reason) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /:id/cancel — Sales, Manager, Employer
router.put('/:id/cancel', authorizeFunction('sales', 'manager'), [
    body('reason').notEmpty()
], validate, async (req, res, next) => {
    try { res.json({ success: true, receipt: await receiptService.cancelReceipt(req, req.params.id, req.body.reason) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

// PUT /price-approval/:approvalId/approve — Manager, Employer
router.put('/price-approval/:approvalId/approve', authorizeFunction('manager'), async (req, res, next) => {
    try { res.json({ success: true, approval: await receiptService.approveBelowPrice(req, req.params.approvalId) }); }
    catch (err) { if (err.status) return res.status(err.status).json({ success: false, error: err.message }); next(err); }
});

router.post('/:id/send-whatsapp', protect, async (req, res, next) => {
    try {
        const receipt = await Receipt.findOne({ _id: req.params.id, company: req.user.company });
        if (!receipt) return res.status(404).json({ success: false, error: 'Receipt not found' });
        if (!receipt.customer?.phone) return res.json({ success: false, message: 'No customer phone on receipt' });
        
        const whatsappService = require('../../../services/whatsappService');
        const result = await whatsappService.sendReceipt(receipt, receipt.customer.phone);
        
        res.json({ 
            success: result.success, 
            message: result.success ? 'Sent via WhatsApp' : (result.error || 'WhatsApp not configured')
        });
    } catch (err) { 
        console.error('[WhatsApp send]', err);
        res.json({ success: false, message: 'WhatsApp error: ' + err.message });
    }
});

router.get('/:id/print', protect, async (req, res, next) => {
    try {
        const Receipt = require('../../../models/Receipt');
        const Customization = require('../../../models/Customization');
        const Company = require('../../../models/Company');
        
        const receipt = await Receipt.findOne({ _id: req.params.id, company: req.user.company })
            .populate('items.inventoryItem');
        if (!receipt) return res.status(404).send('Not found');
        
        const custom = await Customization.getForCompany(req.user.company);
        const tpl = custom.receiptTemplate || {};
        const company = await Company.findById(req.user.company);
        
        const html = `<!DOCTYPE html><html><head><title>${receipt.receiptId}</title>
        <style>
            body{font-family:Arial,sans-serif;max-width:480px;margin:20px auto;padding:20px;font-size:12px;color:#222}
            .header{text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:12px}
            .logo{max-width:90px;margin-bottom:8px}
            .company-name{font-size:20px;font-weight:bold;margin:5px 0}
            .company-info{font-size:11px;color:#555;margin:2px 0}
            .meta{margin:12px 0;font-size:11px}
            .meta-row{display:flex;justify-content:space-between;margin:3px 0}
            table{width:100%;border-collapse:collapse;margin:12px 0}
            th,td{padding:6px 4px;text-align:left;border-bottom:1px solid #ddd;font-size:11px}
            th{background:#f5f5f5;font-weight:bold}
            .totals{margin-top:8px;padding-top:8px;border-top:1px solid #000}
            .total-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px}
            .grand-total{font-size:14px;font-weight:bold;margin-top:5px;padding-top:5px;border-top:2px solid #000}
            .signatures{margin-top:50px;display:flex;justify-content:space-between;gap:40px}
            .signature-box{flex:1;text-align:center}
            .signature-line{border-top:1px solid #000;margin-top:40px;padding-top:4px;font-size:10px}
            .footer{text-align:center;margin-top:20px;font-size:11px;color:#555}
            @media print{.no-print{display:none}}
        </style></head><body>
        ${tpl.headerText ? `<p style="text-align:center;margin-bottom:8px">${tpl.headerText}</p>` : ''}
        <div class="header">
            ${tpl.logoUrl ? `<img src="${tpl.logoUrl}" class="logo" alt="Logo"/>` : ''}
            <div class="company-name">${company.name}</div>
            <div class="company-info">${company.address?.street || ''} ${company.address?.city || ''}</div>
            <div class="company-info">${company.phone || ''} | ${company.email || ''}</div>
        </div>
        
        <div class="meta">
            <div class="meta-row"><span><strong>Receipt:</strong> ${receipt.receiptId}</span><span><strong>Date:</strong> ${new Date(receipt.createdAt).toLocaleDateString()}</span></div>
            <div class="meta-row"><span><strong>Customer:</strong> ${receipt.customer?.name || 'Walk-in'}</span><span><strong>Time:</strong> ${new Date(receipt.createdAt).toLocaleTimeString()}</span></div>
            <div class="meta-row"><span><strong>Phone:</strong> ${receipt.customer?.phone || '-'}</span><span><strong>Store:</strong> ${receipt.storeLocation}</span></div>
            <div class="meta-row"><span><strong>Sold By:</strong> ${receipt.soldByName}</span><span><strong>Payment:</strong> ${(receipt.paymentMethod || '').toUpperCase()}</span></div>
        </div>
        
        <table>
            <thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
            <tbody>
                ${receipt.items.map(item => `
                    <tr>
                        <td>${item.itemName}<br><small style="color:#888">${item.itemCode}</small></td>
                        <td style="text-align:center">${item.quantity} ${item.unit || ''}</td>
                        <td style="text-align:right">${(item.unitPrice || 0).toLocaleString()}</td>
                        <td style="text-align:right">${(item.totalPrice || 0).toLocaleString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="totals">
            <div class="total-row"><span>Subtotal:</span><span>${(receipt.subtotal || 0).toLocaleString()}</span></div>
            ${tpl.showDiscount !== false && receipt.totalDiscount > 0 ? `<div class="total-row"><span>Discount:</span><span>-${(receipt.totalDiscount || 0).toLocaleString()}</span></div>` : ''}
            ${tpl.showTax !== false ? `<div class="total-row"><span>Tax:</span><span>${(receipt.totalTax || 0).toLocaleString()}</span></div>` : ''}
            <div class="total-row grand-total"><span>TOTAL:</span><span>${(receipt.totalAmount || 0).toLocaleString()} XAF</span></div>
        </div>
        
        <div class="signatures">
            <div class="signature-box">
                <div class="signature-line">Customer Signature</div>
            </div>
            <div class="signature-box">
                <div class="signature-line">Seller Signature</div>
            </div>
        </div>
        
        <div class="footer">
            ${tpl.footerText || 'Thank you for your business!'}
        </div>
        
        <button class="no-print" onclick="window.print()" style="margin-top:20px;padding:10px 20px;width:100%;cursor:pointer;background:#2563eb;color:white;border:none;border-radius:4px">Print Receipt</button>
        </body></html>`;
        res.send(html);
    } catch (err) { next(err); }
});
module.exports = router;