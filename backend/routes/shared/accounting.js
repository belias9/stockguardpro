const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect } = require('../../middleware/auth');
const AccountingEntry = require('../../models/AccountingEntry');
const Branch = require('../../models/Branch');
const audit = require('../../utils/auditHelper');
const LedgerAccount = require('../../models/LedgerAccount');
const JournalEntry = require('../../models/JournalEntry');
const Receipt = require('../../models/Receipt');
const ledgerService = require('../../services/ledgerService');

const router = express.Router();
router.use(protect);
const LOAN_TYPES = ['loan_received', 'loan_repayment', 'loan_issued', 'loan_recovered'];
const NON_LOAN_TYPES = ['income', 'expense', 'credit_sale', 'credit_payment'];

function canViewCompanyLoans(user) {
    return user.role === 'employer' || (user.delegatedPermissions || []).some(p => p.key === 'accounting.loans_view' && p.enabled);
}

function hasPermission(user, key) {
    if (user.role === 'employer') return true;
    const delegated = (user.delegatedPermissions || []).some(p => p.key === key && p.enabled);
    if (delegated) return true;
    // Company loan access must always be explicitly granted by an employer.
    if (key === 'accounting.loans_view') return false;
    // Cashiers have a deliberately narrow, branch-only accounting view.
    if (user.activeRoles?.includes('cashier')) return ['accounting.view', 'accounting.create'].includes(key);
    return key.startsWith('accounting.') && user.activeRoles?.includes('accounting');
}
function deny(res) { return res.status(403).json({ success: false, error: 'Employer permission required for this accounting action' }); }

async function accountingScope(req, res) {
    const query = { company: req.user.company, status: 'posted' };
    const allCompanyView = req.user.role === 'employer' || (req.user.delegatedPermissions || []).some(p => p.key === 'accounting.company_view' && p.enabled);
    const loansVisible = canViewCompanyLoans(req.user);
    if (!allCompanyView && loansVisible) query.$or = [{ branch: req.user.branch }, { 'lines.accountCode': { $in: ['1200', '2000'] } }];
    else if (!allCompanyView) query.branch = req.user.branch;
    else if (req.query.branchId) {
        const branch = await Branch.findOne({ _id: req.query.branchId, company: req.user.company, isActive: true }).select('_id');
        if (!branch) { res.status(400).json({ success: false, error: 'Branch is not in this company' }); return null; }
        query.branch = branch._id;
    }
    if (!loansVisible) query['lines.accountCode'] = { $nin: ['1200', '2000'] };
    if (req.query.startDate || req.query.endDate) {
        query.entryDate = {};
        if (req.query.startDate) query.entryDate.$gte = new Date(req.query.startDate);
        if (req.query.endDate) query.entryDate.$lte = new Date(`${req.query.endDate}T23:59:59.999Z`);
    }
    return query;
}

router.get('/ledger/accounts', async (req, res, next) => {
    try {
        if (!hasPermission(req.user, 'accounting.view')) return deny(res);
        if (req.user.activeRoles?.includes('cashier') && !req.user.activeRoles?.includes('accounting')) return res.status(403).json({ success: false, error: 'Chart of accounts is not available to cashier accounts' });
        const accounts = await ledgerService.ensureDefaultAccounts(req.user.company);
        const visible = canViewCompanyLoans(req.user) ? accounts : accounts.filter(a => !['1200', '2000'].includes(a.code));
        res.json({ success: true, accounts: visible });
    } catch (err) { next(err); }
});

router.get('/ledger/journals', async (req, res, next) => {
    try {
        if (!hasPermission(req.user, 'accounting.view')) return deny(res);
        if (req.user.activeRoles?.includes('cashier') && !req.user.activeRoles?.includes('accounting')) return res.status(403).json({ success: false, error: 'Formal journal access is not available to cashier accounts' });
        const query = await accountingScope(req, res);
        if (!query) return;
        const requestedStatus = req.query.status || 'posted';
        if (!['pending', 'posted', 'rejected'].includes(requestedStatus)) return res.status(400).json({ success: false, error: 'Invalid journal status filter' });
        query.status = requestedStatus;
        const entries = await JournalEntry.find(query).populate('branch', 'name').populate('createdBy', 'firstName lastName').populate('approvedBy', 'firstName lastName').sort({ entryDate: -1, createdAt: -1 }).limit(500);
        res.json({ success: true, entries });
    } catch (err) { next(err); }
});

router.get('/ledger/reports/:type', async (req, res, next) => {
    try {
        if (!hasPermission(req.user, 'accounting.view')) return deny(res);
        if (req.user.activeRoles?.includes('cashier') && !req.user.activeRoles?.includes('accounting')) return res.status(403).json({ success: false, error: 'Formal financial reports are not available to cashier accounts' });
        if (!['trial-balance', 'income-statement', 'balance-sheet'].includes(req.params.type)) return res.status(400).json({ success: false, error: 'Unknown ledger report' });
        const query = await accountingScope(req, res);
        if (!query) return;
        const reportEndDate = req.query.endDate || new Date().toISOString().slice(0, 10);
        query.entryDate = query.entryDate || {};
        query.entryDate.$lte = new Date(`${reportEndDate}T23:59:59.999Z`);
        if (req.params.type !== 'income-statement') delete query.entryDate.$gte;
        if (req.params.type === 'income-statement' && !query.entryDate?.$gte) {
            const now = new Date(); query.entryDate.$gte = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
        }
        const rows = await JournalEntry.aggregate([
            { $match: query }, { $unwind: '$lines' },
            { $group: { _id: '$lines.account', debit: { $sum: '$lines.debit' }, credit: { $sum: '$lines.credit' } } },
            { $lookup: { from: LedgerAccount.collection.name, localField: '_id', foreignField: '_id', as: 'account' } },
            { $unwind: '$account' },
            { $project: { _id: 0, accountId: '$account._id', code: '$account.code', name: '$account.name', accountType: '$account.type', debit: 1, credit: 1 } },
            { $sort: { code: 1 } }
        ]);
        const income = rows.filter(r => r.accountType === 'income').reduce((sum, r) => sum + r.credit - r.debit, 0);
        const expenses = rows.filter(r => r.accountType === 'expense').reduce((sum, r) => sum + r.debit - r.credit, 0);
        const filtered = req.params.type === 'income-statement' ? rows.filter(r => ['income', 'expense'].includes(r.accountType))
            : req.params.type === 'balance-sheet' ? rows.filter(r => ['asset', 'liability', 'equity'].includes(r.accountType)) : rows;
        const accounts = filtered.map(row => {
            const debitNormal = ['asset', 'expense'].includes(row.accountType);
            const net = debitNormal ? row.debit - row.credit : row.credit - row.debit;
            return { ...row, debitBalance: Math.max(0, net), creditBalance: Math.max(0, -net) };
        });
        if (req.params.type === 'balance-sheet' && Math.abs(income - expenses) >= 0.005) accounts.push({ code: '3900', name: 'Current Earnings', accountType: 'equity', debitBalance: Math.max(0, expenses - income), creditBalance: Math.max(0, income - expenses) });
        const totalDebits = accounts.reduce((sum, row) => sum + row.debitBalance, 0);
        const totalCredits = accounts.reduce((sum, row) => sum + row.creditBalance, 0);
        const inBalance = ['trial-balance', 'balance-sheet'].includes(req.params.type) ? Math.abs(totalDebits - totalCredits) < 0.01 : null;
        res.json({ success: true, reportType: req.params.type, asOf: reportEndDate, accounts, totals: { debits: totalDebits, credits: totalCredits, income, expenses, netIncome: income - expenses, inBalance } });
    } catch (err) { next(err); }
});

router.post('/ledger/journals', async (req, res, next) => {
    try {
        if (!hasPermission(req.user, 'accounting.create')) return deny(res);
        if (req.user.role !== 'employer' && req.user.activeRoles?.includes('cashier') && !req.user.activeRoles?.includes('accounting')) return res.status(403).json({ success: false, error: 'Cashiers cannot create general journal entries' });
        const { branchId, entryDate, memo, reference = '', lines } = req.body;
        if (!branchId || !entryDate || Number.isNaN(Date.parse(entryDate)) || !String(memo || '').trim()) return res.status(400).json({ success: false, error: 'Branch, valid date and memo are required' });
        const branch = await Branch.findOne({ _id: req.user.role === 'employer' ? branchId : req.user.branch, company: req.user.company, isActive: true });
        if (!branch) return res.status(400).json({ success: false, error: 'Select an active branch in your company' });
        const loanLine = (lines || []).some(line => ['1200', '2000'].includes(String(line.accountCode)));
        if (loanLine && !canViewCompanyLoans(req.user)) return res.status(403).json({ success: false, error: 'Employer authorization is required to post loan accounts' });
        await ledgerService.ensureDefaultAccounts(req.user.company);
        const delegated = req.user.role !== 'employer' && (req.user.delegatedPermissions || []).find(p => p.key === 'accounting.create' && p.enabled);
        const status = delegated?.requiresApproval ? 'pending' : 'posted';
        const entry = await ledgerService.createJournalEntry({ company: req.user.company, branch: branch._id, entryDate, memo, reference, lines, createdBy: req.user._id, status, approvedBy: status === 'posted' ? req.user._id : null });
        await audit.log(req, { action: 'LEDGER_JOURNAL_CREATE', entityType: 'JournalEntry', entityId: entry._id, entityName: memo, changes: { after: { totalDebit: entry.totalDebit, status: entry.status } } });
        res.status(201).json({ success: true, entry });
    } catch (err) { if (err.status || err.name === 'ValidationError') return res.status(err.status || 400).json({ success: false, error: err.message }); next(err); }
});

router.put('/ledger/journals/:id/decision', async (req, res, next) => {
    try {
        if (req.user.role !== 'employer' && !hasPermission(req.user, 'accounting.approve')) return deny(res);
        if (!['posted', 'rejected'].includes(req.body.status)) return res.status(400).json({ success: false, error: 'Decision must be posted or rejected' });
        const entry = await JournalEntry.findOne({ _id: req.params.id, company: req.user.company, status: 'pending' });
        if (!entry) return res.status(404).json({ success: false, error: 'Pending journal entry not found' });
        if (req.user.role !== 'employer' && entry.branch.toString() !== req.user.branch.toString()) return deny(res);
        if (entry.createdBy.toString() === req.user._id.toString()) return res.status(403).json({ success: false, error: 'You cannot approve your own journal entry' });
        entry.status = req.body.status; entry.approvedBy = req.user._id; entry.approvedAt = new Date();
        entry.rejectionReason = req.body.status === 'rejected' ? String(req.body.reason || '').slice(0, 500) : '';
        await entry.save();
        await audit.log(req, { action: `LEDGER_JOURNAL_${req.body.status.toUpperCase()}`, entityType: 'JournalEntry', entityId: entry._id, entityName: entry.memo });
        res.json({ success: true, entry });
    } catch (err) { next(err); }
});

router.post('/ledger/backfill', async (req, res, next) => {
    try {
        if (req.user.role !== 'employer') return deny(res);
        await ledgerService.ensureDefaultAccounts(req.user.company);
        const sourceEntries = await AccountingEntry.find({ company: req.user.company, status: 'approved' }).sort({ date: 1, createdAt: 1 }).limit(5000);
        const result = { examined: sourceEntries.length, posted: 0, alreadyPosted: 0, failed: [] };
        for (const source of sourceEntries) {
            const existing = await JournalEntry.exists({ company: req.user.company, sourceAccountingEntry: source._id });
            if (existing) { result.alreadyPosted++; continue; }
            try { await ledgerService.postAccountingEntry(source, req.user._id); result.posted++; }
            catch (err) { result.failed.push({ entryId: String(source._id), error: err.message }); }
        }
        if (req.body.includeReceipts === true) {
            const receipts = await Receipt.find({ company: req.user.company, status: 'finalized', paymentStatus: 'confirmed' }).sort({ createdAt: 1 }).limit(5000);
            result.receiptsExamined = receipts.length; result.receiptsPosted = 0; result.receiptsAlreadyPosted = 0;
            for (const receipt of receipts) {
                const existing = await JournalEntry.exists({ company: req.user.company, sourceReceipt: receipt._id });
                if (existing) { result.receiptsAlreadyPosted++; continue; }
                try { await ledgerService.postReceipt(receipt); result.receiptsPosted++; }
                catch (err) { result.failed.push({ receiptId: String(receipt._id), error: err.message }); }
            }
        }
        await audit.log(req, { action: 'LEDGER_BACKFILL', entityType: 'JournalEntry', entityName: 'Accounting ledger backfill', changes: { after: { examined: result.examined, posted: result.posted, alreadyPosted: result.alreadyPosted, failed: result.failed.length } } });
        res.json({ success: true, result });
    } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
    try {
        if (!hasPermission(req.user, 'accounting.view')) return deny(res);
        const query = { company: req.user.company };
        const allCompanyView = req.user.role === 'employer' || (req.user.delegatedPermissions || []).some(p => p.key === 'accounting.company_view' && p.enabled);
        const loansVisible = canViewCompanyLoans(req.user);
        if (!allCompanyView && loansVisible) query.$or = [{ branch: req.user.branch }, { type: { $in: LOAN_TYPES } }];
        else if (!allCompanyView) query.branch = req.user.branch;
        else if (req.query.branchId) {
            const branch = await Branch.findOne({ _id: req.query.branchId, company: req.user.company, isActive: true }).select('_id');
            if (!branch) return res.status(400).json({ success: false, error: 'Branch is not in this company' });
            query.branch = branch._id;
        }
        const isCashier = req.user.role !== 'employer' && req.user.activeRoles?.includes('cashier') && !req.user.activeRoles?.includes('accounting');
        if (isCashier) query.type = { $in: loansVisible ? ['expense', 'credit_sale', 'credit_payment', ...LOAN_TYPES] : ['expense', 'credit_sale', 'credit_payment'] };
        else if (!loansVisible) query.type = { $in: NON_LOAN_TYPES };
        if (req.query.status) query.status = req.query.status;
        if (req.query.startDate || req.query.endDate) {
            query.date = {};
            if (req.query.startDate) query.date.$gte = new Date(req.query.startDate);
            if (req.query.endDate) query.date.$lte = new Date(req.query.endDate);
        }
        const entries = await AccountingEntry.find(query).populate('branch', 'name').populate('createdBy', 'firstName lastName').populate('approvedBy', 'firstName lastName').sort({ date: -1, createdAt: -1 }).limit(500);
        const summaryQuery = { ...query, status: 'approved' };
        const [totals = {}] = await AccountingEntry.aggregate([
            { $match: summaryQuery },
            { $group: { _id: null,
                income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
                expenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
                creditSale: { $sum: { $cond: [{ $eq: ['$type', 'credit_sale'] }, '$amount', 0] } },
                creditPayment: { $sum: { $cond: [{ $eq: ['$type', 'credit_payment'] }, '$amount', 0] } },
                loanReceived: { $sum: { $cond: [{ $eq: ['$type', 'loan_received'] }, '$amount', 0] } },
                loanRepayment: { $sum: { $cond: [{ $eq: ['$type', 'loan_repayment'] }, '$amount', 0] } },
                loanIssued: { $sum: { $cond: [{ $eq: ['$type', 'loan_issued'] }, '$amount', 0] } },
                loanRecovered: { $sum: { $cond: [{ $eq: ['$type', 'loan_recovered'] }, '$amount', 0] } }
            } }
        ]);
        const { income = 0, expenses = 0, creditSale = 0, creditPayment = 0, loanReceived = 0, loanRepayment = 0, loanIssued = 0, loanRecovered = 0 } = totals;
        const summary = {
            income, expenses,
            balance: income + creditPayment + loanReceived + loanRecovered - expenses - loanRepayment - loanIssued,
            creditReceivable: creditSale - creditPayment
        };
        if (isCashier) {
            summary.pendingExpenses = await AccountingEntry.countDocuments({ ...query, type: 'expense', status: 'pending' });
            if (loansVisible) {
                summary.loansPayable = loanReceived - loanRepayment;
                summary.loansReceivable = loanIssued - loanRecovered;
            }
            res.json({ success: true, entries, summary: { ...summary, ...(loansVisible ? {} : { income: undefined, balance: undefined }) } });
            return;
        }
        if (loansVisible) {
            summary.loansPayable = loanReceived - loanRepayment;
            summary.loansReceivable = loanIssued - loanRecovered;
        }
        res.json({ success: true, entries, summary });
    } catch (err) { next(err); }
});

router.post('/', [
    body('type').isIn(['income', 'expense', 'credit_sale', 'credit_payment', 'loan_received', 'loan_repayment', 'loan_issued', 'loan_recovered']), body('category').trim().notEmpty(),
    body('amount').isFloat({ min: 0.01 }), body('date').isISO8601(), body('branchId').notEmpty()
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });
        if (!hasPermission(req.user, 'accounting.create')) return deny(res);
        const isCashier = req.user.role !== 'employer' && req.user.activeRoles?.includes('cashier') && !req.user.activeRoles?.includes('accounting');
        if (LOAN_TYPES.includes(req.body.type) && !canViewCompanyLoans(req.user)) {
            return res.status(403).json({ success: false, error: 'Company loan access must be granted by an employer' });
        }
        if (isCashier && !['expense', 'credit_sale', 'credit_payment'].includes(req.body.type)) {
            return res.status(403).json({ success: false, error: 'Cashiers may only record customer credit activity and branch expenses' });
        }
        const branchId = req.user.role === 'employer' ? req.body.branchId : req.user.branch;
        const branch = await Branch.findOne({ _id: branchId, company: req.user.company, isActive: true });
        if (!branch) return res.status(400).json({ success: false, error: 'Select an active branch in your company' });
        const delegated = req.user.role !== 'employer' && (req.user.delegatedPermissions || []).find(p => p.key === 'accounting.create' && p.enabled);
        const needsApproval = isCashier ? req.body.type === 'expense' : !!delegated?.requiresApproval;
        const entry = await AccountingEntry.create({
            company: req.user.company, branch: branch._id, type: req.body.type,
            category: req.body.category, description: req.body.description || '', amount: Number(req.body.amount),
            date: new Date(req.body.date), reference: req.body.reference || '', counterparty: req.body.counterparty || '', createdBy: req.user._id,
            status: needsApproval ? 'pending' : 'approved',
            approvedBy: needsApproval ? null : req.user._id,
            approvedAt: needsApproval ? null : new Date()
        });
        if (entry.status === 'approved') {
            try { await ledgerService.postAccountingEntry(entry, req.user._id); }
            catch (err) { await AccountingEntry.deleteOne({ _id: entry._id }); throw err; }
        }
        await audit.log(req, { action: 'ACCOUNTING_ENTRY_CREATE', entityType: 'AccountingEntry', entityId: entry._id, entityName: `${entry.type}: ${entry.category}`, changes: { after: { amount: entry.amount, status: entry.status } } });
        res.status(201).json({ success: true, entry });
    } catch (err) { next(err); }
});

router.put('/:id/decision', async (req, res, next) => {
    try {
        if (req.user.role !== 'employer' && !hasPermission(req.user, 'accounting.approve')) return deny(res);
        if (!['approved', 'rejected'].includes(req.body.status)) return res.status(400).json({ success: false, error: 'Status must be approved or rejected' });
        const entry = await AccountingEntry.findOne({ _id: req.params.id, company: req.user.company, status: 'pending' });
        if (!entry) return res.status(404).json({ success: false, error: 'Pending entry not found' });
        if (req.user.role !== 'employer' && entry.branch.toString() !== req.user.branch.toString()) return deny(res);
        if (entry.createdBy.toString() === req.user._id.toString()) return res.status(403).json({ success: false, error: 'You cannot approve your own entry' });
        entry.status = req.body.status;
        entry.approvedBy = req.user._id;
        entry.approvedAt = new Date();
        entry.rejectionReason = req.body.status === 'rejected' ? String(req.body.reason || '') : '';
        await entry.save();
        if (entry.status === 'approved') {
            try { await ledgerService.postAccountingEntry(entry, req.user._id); }
            catch (err) {
                entry.status = 'pending'; entry.approvedBy = null; entry.approvedAt = null;
                await entry.save();
                throw err;
            }
        }
        await audit.log(req, { action: `ACCOUNTING_ENTRY_${req.body.status.toUpperCase()}`, entityType: 'AccountingEntry', entityId: entry._id, entityName: `${entry.type}: ${entry.category}` });
        res.json({ success: true, entry });
    } catch (err) { next(err); }
});

module.exports = router;
