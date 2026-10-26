/**
 * AI Service
 * OpenAI integration — insights, predictions, stock query, reports.
 * Gracefully skips if OPENAI_API_KEY not set.
 */
const OpenAI = require('openai');
const logger = require('../utils/logger');

let openai = null;
let model = 'gpt-4o';

// ============================================================
// Lazy init (doesn't crash if no key)
// ============================================================
function getClient() {
    if (!process.env.OPENAI_API_KEY) return null;
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        model = process.env.OPENAI_MODEL || 'gpt-4o';
    }
    return openai;
}

// ============================================================
// Prompt injection defense
// ============================================================
function sanitizeInput(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\bignore\s+(all\s+)?previous\s+instructions?\b/gi, '[REDACTED]')
        .replace(/\byou\s+are\s+now\b/gi, '[REDACTED]')
        .replace(/\bsystem\s*:\s*/gi, '[REDACTED]')
        .slice(0, 2000); // cap length
}

// ============================================================
// Fallback (no key configured)
// ============================================================
function noKeyResponse(feature) {
    return {
        available: false,
        message: `AI feature '${feature}' requires OPENAI_API_KEY to be set in .env`,
        ...(feature === 'insights' && {
            insights: [], risks: [], recommendations: [], predictions: [], actionItems: []
        }),
        ...(feature === 'stockQuery' && { found: false, status: 'not_configured', message: 'AI not configured' }),
        ...(feature === 'predict' && { predictions: [], trends: [], cashFlowImpact: 0 })
    };
}

// ============================================================
// Business insights (employer)
// ============================================================
async function generateInsights(req, companyData) {
    const client = getClient();
    if (!client) return noKeyResponse('insights');

    const prompt = `You are StockGuardPro AI, a business intelligence assistant for a stock control system.

Analyze this company data:

INVENTORY: ${companyData.inventory?.totalItems || 0} items, ${companyData.inventory?.lowStock || 0} low stock, value ${companyData.inventory?.totalValue || 0}
WITHDRAWALS: ${companyData.withdrawals?.pending || 0} pending, ${companyData.withdrawals?.today || 0} today
ATTENDANCE: ${companyData.attendance?.presentToday || 0} present, ${companyData.attendance?.absentToday || 0} absent, rate ${companyData.attendance?.attendanceRate || 0}%
SALARY: ${companyData.salary?.pendingPayments || 0} pending, ${companyData.salary?.disputed || 0} disputed
COMMUNICATION: ${companyData.communication?.unreadMessages || 0} unread, ${companyData.communication?.pendingComplaints || 0} complaints

Provide JSON with keys: insights (array of strings), risks (array), recommendations (array), predictions (array), actionItems (array of {priority, action, deadline}).`;

    try {
        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: 'You are a business intelligence expert. Always respond in valid JSON. Do not include any other text.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 1500
        });

        return {
            available: true,
            ...JSON.parse(response.choices[0].message.content)
        };
    } catch (err) {
        logger.error('[AI] Insights failed:', err.message);
        return noKeyResponse('insights');
    }
}

// ============================================================
// Stock query (employee)
// ============================================================
async function processStockQuery(req, query, inventoryItems) {
    const client = getClient();
    if (!client) return noKeyResponse('stockQuery');

    const cleanQuery = sanitizeInput(query);

    // Strip cost price from inventory data
    const itemsContext = inventoryItems.map(i => ({
        name: i.name,
        code: i.itemCode,
        quantity: i.quantity,
        unit: i.unit,
        location: i.location?.warehouse || 'N/A',
        minLevel: i.minStockLevel,
        reorder: i.reorderPoint,
        sellingPrice: i.sellingPrice
        // NO unitCost — never send cost to AI
    }));

    const prompt = `You are a stock assistant. Employee query: "${cleanQuery}"

Available inventory:
${JSON.stringify(itemsContext, null, 2).slice(0, 8000)}

Respond in JSON with: found (boolean), itemName, quantity, unit, location, status ("ok"/"low"/"critical"/"not_found"), message, suggestions (array of item names).`;

    try {
        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: 'You are a helpful stock assistant. Respond in valid JSON only.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 500
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (err) {
        logger.error('[AI] Stock query failed:', err.message);
        return { found: false, status: 'error', message: 'AI temporarily unavailable' };
    }
}

// ============================================================
// AI-assisted stock input
// ============================================================
async function assistStockInput(req, inputData, existingItems) {
    const client = getClient();
    if (!client) {
        return { available: false, isValid: true, warnings: [] };
    }

    const prompt = `You are a stock input validator. Help the user fill out a new item correctly.

Input: ${JSON.stringify(inputData)}

Existing items (for duplicate check):
${existingItems.slice(0, 50).map(i => `${i.name} (${i.itemCode}) - ${i.category}`).join('\n')}

Respond in JSON with: isNewItem (boolean), suggestedCode (string), suggestedCategory (string), suggestedMinStock (number), suggestedReorderPoint (number), suggestedSellingPrice (number), warnings (array of strings), isValid (boolean).`;

    try {
        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: 'You are a data validation assistant. Respond in valid JSON only.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 400
        });

        return { available: true, ...JSON.parse(response.choices[0].message.content) };
    } catch (err) {
        logger.error('[AI] Assist input failed:', err.message);
        return { available: false, isValid: true, warnings: [] };
    }
}

// ============================================================
// Voice command processing
// ============================================================
async function processVoiceCommand(req, transcript) {
    const client = getClient();
    if (!client) return { action: 'UNKNOWN', confidence: 0, response: 'AI not configured' };

    const clean = sanitizeInput(transcript);

    const prompt = `Convert this voice command to a structured action.

User role: ${req.user.role}
Command: "${clean}"

Possible actions: CHECK_STOCK, ADD_STOCK, CHECK_ATTENDANCE, CHECK_SALARY, UNKNOWN

Respond in JSON with: action (string), parameters (object), confidence (0-1), response (friendly message to user).`;

    try {
        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: 'You are a command processor. Respond in valid JSON only.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: 300
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (err) {
        logger.error('[AI] Voice command failed:', err.message);
        return { action: 'UNKNOWN', confidence: 0, response: 'Could not process command' };
    }
}

// ============================================================
// Inventory predictions
// ============================================================
async function predictInventory(req, historicalData) {
    const client = getClient();
    if (!client) return noKeyResponse('predict');

    // Strip cost
    const cleanData = historicalData.map(d => ({
        name: d.name,
        currentStock: d.currentStock,
        monthlyUsage: d.monthlyUsage,
        category: d.category
        // NO cost
    }));

    const prompt = `Predict inventory needs for next month.

Historical data:
${JSON.stringify(cleanData).slice(0, 8000)}

Respond in JSON with: predictions (array of {itemName, currentStock, predictedNeed, recommendedOrder, urgency: "low"/"medium"/"high"}), trends (array of strings), cashFlowImpact (number, in local currency).`;

    try {
        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: 'You are a predictive analytics expert. Respond in valid JSON only.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.5,
            max_tokens: 1500
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (err) {
        logger.error('[AI] Predict failed:', err.message);
        return noKeyResponse('predict');
    }
}

// ============================================================
// Report generation
// ============================================================
async function generateReport(req, reportType, data, period) {
    const client = getClient();
    if (!client) return 'AI report generation requires OPENAI_API_KEY to be configured.';

    const prompt = `Generate a professional ${reportType} business report for the period: ${period}.

Data:
${JSON.stringify(data).slice(0, 10000)}

Write a comprehensive report with:
1. Executive Summary
2. Key Metrics
3. Trends
4. Issues
5. Recommendations
6. Next Steps

Format as plain text with clear sections.`;

    try {
        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: 'You are a professional business report writer.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        return response.choices[0].message.content;
    } catch (err) {
        logger.error('[AI] Report failed:', err.message);
        return 'Report generation failed. Please try again.';
    }
}

module.exports = {
    generateInsights,
    processStockQuery,
    assistStockInput,
    processVoiceCommand,
    predictInventory,
    generateReport,
    isConfigured: () => !!process.env.OPENAI_API_KEY
};