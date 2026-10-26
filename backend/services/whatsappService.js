/**
 * WhatsApp Service
 * Meta Cloud API integration.
 * Gracefully skips if not configured.
 */
const crypto = require('crypto');
const logger = require('../utils/logger');

// ============================================================
// Config
// ============================================================
function isConfigured() {
    return !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

function formatPhone(phone) {
    if (!phone) return null;
    let cleaned = phone.toString().replace(/\D/g, '');
    // Cameroon: +237 → 237
    if (cleaned.length === 9) cleaned = '237' + cleaned;
    if (cleaned.length === 10 && cleaned.startsWith('0')) cleaned = '237' + cleaned.substring(1);
    if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = '237' + cleaned.substring(1);
    return cleaned;
}

function formatCurrency(amount) {
    if (amount === null || amount === undefined) return 'XAF 0.00';
    return 'XAF ' + parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================
// Core send
// ============================================================
async function sendMessage(to, message, templateName = null) {
    if (!isConfigured()) {
        logger.warn('[WhatsApp] Not configured — skipping send', { to });
        return { success: false, error: 'WhatsApp not configured' };
    }

    const formattedPhone = formatPhone(to);
    if (!formattedPhone) {
        return { success: false, error: 'Invalid phone number' };
    }

    const payload = templateName ? {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'template',
        template: { name: templateName, language: { code: 'en' }, components: message.components || [] }
    } : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: { body: message, preview_url: false }
    };

    try {
        const res = await fetch(
            `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'WhatsApp API error');

        logger.info('[WhatsApp] Sent', { to: formattedPhone, messageId: data.messages?.[0]?.id });
        return { success: true, messageId: data.messages?.[0]?.id };
    } catch (err) {
        logger.error('[WhatsApp] Send failed:', err.message);
        return { success: false, error: err.message };
    }
}

// ============================================================
// Templates
// ============================================================

async function sendReceipt(receipt, customerPhone) {
    if (!customerPhone) return { success: false, error: 'No phone number' };

    const itemsList = receipt.items.map(item =>
        `• ${item.itemName} x${item.quantity} = ${formatCurrency(item.totalPrice)}`
    ).join('\n');

    const message = `🧾 *RECEIPT — ${receipt.receiptId}*

*Store:* ${receipt.storeLocation}
*Date:* ${new Date(receipt.createdAt).toLocaleString()}
*Sold By:* ${receipt.soldByName}

*Items:*
${itemsList}

*Subtotal:* ${formatCurrency(receipt.subtotal)}
*Tax:* ${formatCurrency(receipt.totalTax)}
*Total:* ${formatCurrency(receipt.totalAmount)}
*Payment:* ${receipt.paymentMethod?.toUpperCase()}

Thank you for your business! 🙏
_StockGuardPro_`;

    return sendMessage(customerPhone, message);
}

async function sendStockAlert(item, recipientPhone) {
    const message = `⚠️ *LOW STOCK ALERT*

Item: *${item.name}* (${item.itemCode})
Current: *${item.quantity} ${item.unit}*
Reorder at: ${item.reorderPoint}

Please restock soon!

_StockGuardPro_`;
    return sendMessage(recipientPhone, message);
}

async function sendWithdrawalNotification(withdrawal, recipientPhone, type = 'new') {
    let message;
    if (type === 'new') {
        message = `📦 *NEW WITHDRAWAL REQUEST*

ID: ${withdrawal.withdrawalId}
Store: ${withdrawal.storeLocation}
Items: ${withdrawal.totalItems}
Value: ${formatCurrency(withdrawal.totalCost)}
Requested by: ${withdrawal.requesterName}

Please review and approve.

_StockGuardPro_`;
    } else if (type === 'approved') {
        message = `✅ *WITHDRAWAL APPROVED*

ID: ${withdrawal.withdrawalId}

Stockhouse can now dispatch.

_StockGuardPro_`;
    } else if (type === 'dispatched') {
        message = `🚚 *WITHDRAWAL DISPATCHED*

ID: ${withdrawal.withdrawalId}
Collector: ${withdrawal.dispatch?.collectorName || 'N/A'}

On the way to ${withdrawal.destinationBranch || 'destination'}.

_StockGuardPro_`;
    }
    return sendMessage(recipientPhone, message);
}

async function sendSalaryNotification(employeePhone, salary, type = 'paid') {
    const message = `💰 *SALARY PAID*

Period: ${salary.period}
Net Salary: *${formatCurrency(salary.netSalary)}*

Payment Method: ${salary.payment?.paymentMethod || 'bank_transfer'}

Thank you for your hard work! 🎉

_StockGuardPro Payroll_`;
    return sendMessage(employeePhone, message);
}

async function sendMessageNotification(recipientPhone, senderName, subject, preview) {
    const message = `📩 *NEW MESSAGE*

From: ${senderName}
Subject: ${subject}

${(preview || '').substring(0, 150)}${(preview || '').length > 150 ? '...' : ''}

Open StockGuardPro to respond.

_StockGuardPro_`;
    return sendMessage(recipientPhone, message);
}

async function sendAttendanceReminder(employeePhone, employeeName, type = 'clock_in') {
    const message = type === 'clock_in'
        ? `⏰ Good morning ${employeeName}!

Don't forget to clock in today.

_StockGuardPro_`
        : `🌆 Hi ${employeeName},

Please remember to clock out before leaving.

_StockGuardPro_`;
    return sendMessage(employeePhone, message);
}

// ============================================================
// Webhook signature verification
// ============================================================
function verifyWebhookSignature(rawBody, signature) {
    if (!process.env.WHATSAPP_APP_SECRET) return false;
    if (!signature) return false;

    const expected = 'sha256=' + crypto
        .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
        .update(rawBody)
        .digest('hex');

    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
        return false;
    }
}

module.exports = {
    isConfigured,
    sendMessage,
    sendReceipt,
    sendStockAlert,
    sendWithdrawalNotification,
    sendSalaryNotification,
    sendMessageNotification,
    sendAttendanceReminder,
    verifyWebhookSignature,
    formatPhone
};