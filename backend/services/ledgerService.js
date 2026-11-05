const LedgerAccount = require('../models/LedgerAccount');
const JournalEntry = require('../models/JournalEntry');

const DEFAULT_ACCOUNTS = [
    { code: '1000', name: 'Cash on Hand', type: 'asset' },
    { code: '1010', name: 'Bank', type: 'asset' },
    { code: '1100', name: 'Accounts Receivable', type: 'asset' },
    { code: '1200', name: 'Loans Receivable', type: 'asset' },
    { code: '1300', name: 'Inventory Asset', type: 'asset' },
    { code: '2000', name: 'Loans Payable', type: 'liability' },
    { code: '2100', name: 'Tax Payable', type: 'liability' },
    { code: '3000', name: 'Owner Equity', type: 'equity' },
    { code: '4000', name: 'Sales Income', type: 'income' },
    { code: '4100', name: 'Other Income', type: 'income' },
    { code: '5000', name: 'Operating Expenses', type: 'expense' },
    { code: '5100', name: 'Cost of Goods Sold', type: 'expense' }
];

const SOURCE_POSTINGS = {
    income: [['1000', 'debit'], ['4100', 'credit']],
    expense: [['5000', 'debit'], ['1000', 'credit']],
    credit_sale: [['1100', 'debit'], ['4000', 'credit']],
    credit_payment: [['1000', 'debit'], ['1100', 'credit']],
    loan_received: [['1000', 'debit'], ['2000', 'credit']],
    loan_repayment: [['2000', 'debit'], ['1000', 'credit']],
    loan_issued: [['1200', 'debit'], ['1000', 'credit']],
    loan_recovered: [['1000', 'debit'], ['1200', 'credit']]
};

async function ensureDefaultAccounts(companyId) {
    try {
        await LedgerAccount.bulkWrite(DEFAULT_ACCOUNTS.map(account => ({
            updateOne: {
                filter: { company: companyId, code: account.code },
                update: { $setOnInsert: { ...account, company: companyId, isSystem: true, isActive: true } },
                upsert: true
            }
        })), { ordered: false });
    } catch (err) {
        if (err.code !== 11000 && !err.writeErrors?.every(writeError => writeError.code === 11000)) throw err;
    }
    return LedgerAccount.find({ company: companyId, isActive: true }).sort({ code: 1 });
}

function assertBalanced(lines) {
    if (!Array.isArray(lines) || lines.length < 2) throw Object.assign(new Error('A journal entry needs at least two lines'), { status: 400 });
    let debit = 0;
    let credit = 0;
    for (const line of lines) {
        const d = Number(line.debit || 0);
        const c = Number(line.credit || 0);
        if (!Number.isFinite(d) || !Number.isFinite(c) || d < 0 || c < 0 || (d > 0) === (c > 0)) {
            throw Object.assign(new Error('Each journal line must have one positive debit or credit amount'), { status: 400 });
        }
        debit += Math.round(d * 100);
        credit += Math.round(c * 100);
    }
    if (debit <= 0 || debit !== credit) throw Object.assign(new Error('Journal entry debits must equal credits'), { status: 400 });
    return { totalDebit: debit / 100, totalCredit: credit / 100 };
}

async function createJournalEntry({ company, branch, entryDate, memo, reference = '', lines, createdBy, source = 'manual', sourceAccountingEntry = null, status = 'posted', approvedBy = null }) {
    const totals = assertBalanced(lines);
    const accounts = await LedgerAccount.find({ company, code: { $in: [...new Set(lines.map(line => String(line.accountCode || '').trim().toUpperCase()))] }, isActive: true });
    const byCode = new Map(accounts.map(account => [account.code, account]));
    const normalizedLines = lines.map(line => {
        const account = byCode.get(String(line.accountCode || '').trim().toUpperCase());
        if (!account) throw Object.assign(new Error(`Active account not found: ${line.accountCode}`), { status: 400 });
        return {
            account: account._id, accountCode: account.code, accountName: account.name,
            debit: Math.round(Number(line.debit || 0) * 100) / 100,
            credit: Math.round(Number(line.credit || 0) * 100) / 100,
            description: String(line.description || '').trim().slice(0, 250)
        };
    });
    const entry = await JournalEntry.create({ company, branch, entryDate: new Date(entryDate), memo, reference, lines: normalizedLines, ...totals, createdBy, source, sourceAccountingEntry, status, approvedBy, approvedAt: approvedBy ? new Date() : null });
    return entry;
}

async function postAccountingEntry(entry, actorId) {
    if (entry.status !== 'approved') return null;
    const existing = await JournalEntry.findOne({ company: entry.company, sourceAccountingEntry: entry._id });
    if (existing) return existing;
    const posting = SOURCE_POSTINGS[entry.type];
    if (!posting) throw new Error(`No ledger posting rule for accounting type: ${entry.type}`);
    const accounts = await ensureDefaultAccounts(entry.company);
    const byCode = new Map(accounts.map(account => [account.code, account]));
    const amount = Math.round(Number(entry.amount) * 100) / 100;
    const lines = posting.map(([accountCode, side]) => ({
        accountCode,
        debit: side === 'debit' ? amount : 0,
        credit: side === 'credit' ? amount : 0,
        description: entry.counterparty || entry.category
    }));
    try {
        return await JournalEntry.create({
            company: entry.company, branch: entry.branch, entryDate: entry.date,
            memo: entry.description || `${entry.category}: ${entry.counterparty || entry.type}`,
            reference: entry.reference, source: 'accounting_entry', sourceAccountingEntry: entry._id,
            lines: lines.map(line => ({ ...line, account: byCode.get(line.accountCode)._id, accountName: byCode.get(line.accountCode).name })),
            totalDebit: amount, totalCredit: amount, createdBy: actorId || entry.createdBy
        });
    } catch (err) {
        if (err.code === 11000) return JournalEntry.findOne({ company: entry.company, sourceAccountingEntry: entry._id });
        throw err;
    }
}

async function postReceipt(receipt) {
    if (receipt.status !== 'finalized' || receipt.paymentStatus !== 'confirmed') return null;
    const existing = await JournalEntry.findOne({ company: receipt.company, sourceReceipt: receipt._id });
    if (existing) return existing;
    const accounts = await ensureDefaultAccounts(receipt.company);
    const byCode = new Map(accounts.map(account => [account.code, account]));
    const amount = Math.round(Number(receipt.totalAmount || 0) * 100) / 100;
    const taxableSales = Math.max(0, Math.round((Number(receipt.subtotal || 0) - Number(receipt.totalDiscount || 0)) * 100) / 100);
    const tax = Math.max(0, Math.round(Number(receipt.totalTax || 0) * 100) / 100);
    const cost = Math.max(0, Math.round(Number(receipt.totalCost || 0) * 100) / 100);
    const cashCode = receipt.paymentMethod === 'credit' ? '1100' : ['card', 'bank_transfer', 'mobile_money'].includes(receipt.paymentMethod) ? '1010' : '1000';
    const lines = [];
    if (amount > 0) lines.push({ accountCode: cashCode, debit: amount, credit: 0, description: `Receipt ${receipt.receiptId}` });
    if (taxableSales > 0) lines.push({ accountCode: '4000', debit: 0, credit: taxableSales, description: `Receipt ${receipt.receiptId}` });
    if (tax > 0) lines.push({ accountCode: '2100', debit: 0, credit: tax, description: `Tax on receipt ${receipt.receiptId}` });
    if (cost > 0) {
        lines.push({ accountCode: '5100', debit: cost, credit: 0, description: `Cost of goods sold ${receipt.receiptId}` });
        lines.push({ accountCode: '1300', debit: 0, credit: cost, description: `Inventory relieved ${receipt.receiptId}` });
    }
    if (!lines.length) return null;
    const totals = assertBalanced(lines);
    try {
        return await JournalEntry.create({
            company: receipt.company, branch: receipt.branch, entryDate: receipt.cashierConfirmation?.confirmedAt || receipt.updatedAt || new Date(),
            memo: `Sale ${receipt.receiptId}`, reference: receipt.receiptId, source: 'receipt', sourceReceipt: receipt._id,
            lines: lines.map(line => ({ ...line, account: byCode.get(line.accountCode)._id, accountName: byCode.get(line.accountCode).name })),
            ...totals, createdBy: receipt.cashierConfirmation?.confirmedBy || receipt.soldBy, approvedBy: receipt.cashierConfirmation?.confirmedBy || receipt.soldBy, approvedAt: receipt.cashierConfirmation?.confirmedAt || new Date()
        });
    } catch (err) {
        if (err.code === 11000) return JournalEntry.findOne({ company: receipt.company, sourceReceipt: receipt._id });
        throw err;
    }
}

module.exports = { DEFAULT_ACCOUNTS, SOURCE_POSTINGS, ensureDefaultAccounts, assertBalanced, createJournalEntry, postAccountingEntry, postReceipt };
