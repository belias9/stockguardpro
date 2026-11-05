const accountingApi = {
    list: params => api.get(`/accounting?${qs(params)}`),
    create: data => api.post('/accounting', data),
    decide: (id, status) => api.put(`/accounting/${id}/decision`, { status }),
    accounts: () => api.get('/accounting/ledger/accounts'),
    report: (type, params) => api.get(`/accounting/ledger/reports/${type}?${qs(params)}`),
    journals: params => api.get(`/accounting/ledger/journals?${qs(params)}`),
    createJournal: data => api.post('/accounting/ledger/journals', data),
    decideJournal: (id, status) => api.put(`/accounting/ledger/journals/${id}/decision`, { status }),
    backfill: data => api.post('/accounting/ledger/backfill', data || {})
};

class AccountingPage {
    constructor() { this.entries = []; this.branches = []; this.summary = {}; }
    isCashier() { return auth.user.role !== 'employer' && auth.user.activeRoles?.includes('cashier') && !auth.user.activeRoles?.includes('accounting'); }
    canViewLoans() { return auth.user.role === 'employer' || (auth.user.delegatedPermissions || []).some(p => p.enabled && p.key === 'accounting.loans_view'); }
    canCreate() {
        return auth.user.role === 'employer' || auth.user.activeRoles?.some(r => ['accounting', 'cashier'].includes(r)) || (auth.user.delegatedPermissions || []).some(p => p.enabled && p.key === 'accounting.create');
    }
    canApprove() {
        return auth.user.role === 'employer' || auth.user.activeRoles?.includes('accounting') || (auth.user.delegatedPermissions || []).some(p => p.enabled && p.key === 'accounting.approve');
    }
    async render(container) {
        const employer = auth.user.role === 'employer';
        const cashier = this.isCashier();
        container.innerHTML = `<div class="page-header"><div><h1>${cashier ? 'Customer Credit & Branch Expenses' : 'Accounting'}</h1><p class="text-secondary">${cashier ? 'Record customer credit activity and submit expenses for your branch.' : 'Review company finances, branch expenses, customer credit and loans.'}</p></div></div>
          <div class="stats-grid" id="acct-summary"></div>
          <div class="card mb-4"><div class="card-body"><div class="flex gap-2" style="align-items:end;flex-wrap:wrap">
            ${employer ? `<div class="form-group"><label for="acct-branch-filter">Branch</label><select id="acct-branch-filter"><option value="">All branches</option></select></div>` : ''}
            <div class="form-group"><label for="acct-start">From</label><input id="acct-start" type="date"></div>
            <div class="form-group"><label for="acct-end">To</label><input id="acct-end" type="date"></div>
            <div class="form-group"><label for="acct-status">Status</label><select id="acct-status"><option value="">All statuses</option><option value="approved">Approved</option><option value="pending">Pending approval</option><option value="rejected">Rejected</option></select></div>
            <button class="btn btn-secondary" onclick="pageAccounting.load()">Apply filters</button>
            <button class="btn btn-secondary" onclick="pageAccounting.exportCsv()">Download CSV</button>
          </div></div></div>
          <div class="card"><div class="card-header"><h3>${cashier ? 'Branch customer and expense ledger' : 'Company financial ledger'}</h3>${this.canCreate() ? '<button class="btn btn-primary" onclick="pageAccounting.showCreate()">Record Entry</button>' : ''}</div>
          <div class="card-body"><div id="acct-table">${ui.loader()}</div></div></div>
          ${cashier ? '' : `<div class="card mt-4"><div class="card-header"><h3>Double-entry ledger and financial statements</h3><div class="flex gap-2" style="flex-wrap:wrap">${auth.user.role==='employer' ? '<button class="btn btn-secondary" onclick="pageAccounting.backfillLedger()">Post existing approved entries</button><button class="btn btn-secondary" onclick="pageAccounting.backfillReceipts()">Post existing confirmed receipts</button>' : ''}${this.canCreate() ? '<button class="btn btn-primary" onclick="pageAccounting.showJournalModal()">New Journal Entry</button>' : ''}</div></div><div class="card-body"><div class="flex gap-2" style="align-items:end;flex-wrap:wrap"><div class="form-group"><label>Report</label><select id="ledger-report-type"><option value="trial-balance">Trial Balance</option><option value="income-statement">Income Statement</option><option value="balance-sheet">Balance Sheet</option></select></div><div class="form-group"><label>From</label><input type="date" id="ledger-start" value="${new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10)}"></div><div class="form-group"><label>As of / To</label><input type="date" id="ledger-end" value="${new Date().toISOString().slice(0,10)}"></div><button class="btn btn-secondary" onclick="pageAccounting.loadFormalReport()">Run report</button><button class="btn btn-secondary" onclick="pageAccounting.downloadFormalReport()">Download CSV</button></div><div id="ledger-report-result" class="mt-3">Choose Run report to view posted journal balances.</div><div id="ledger-pending-approvals" class="mt-4"></div><div id="ledger-journal-history" class="mt-4"></div></div></div>`}`;
        if (employer) {
            try {
                this.branches = (await branchesApi.list()).branches || [];
                const select = document.getElementById('acct-branch-filter');
                select.innerHTML += this.branches.map(b => `<option value="${utils.escapeHtml(b._id)}">${utils.escapeHtml(b.name)}</option>`).join('');
            } catch { this.branches = []; }
        }
        if (!cashier) {
            try { this.ledgerAccounts = (await accountingApi.accounts()).accounts || []; }
            catch (err) { this.ledgerAccounts = []; ui.showToast('warning','Ledger setup unavailable',err.message); }
        }
        await this.load();
    }
    filters() {
        return {
            branchId: document.getElementById('acct-branch-filter')?.value || '',
            startDate: document.getElementById('acct-start')?.value || '',
            endDate: document.getElementById('acct-end')?.value || '',
            status: document.getElementById('acct-status')?.value || ''
        };
    }
    async load() {
        try {
            const res = await accountingApi.list(this.filters());
            this.entries = res.entries || []; this.summary = res.summary || {};
            const s = this.summary; const cashier = this.isCashier();
            const cards = cashier
                ? [['Customer credit due', s.creditReceivable], ['Approved branch expenses', s.expenses], ['Expenses awaiting approval', s.pendingExpenses]]
                : [['Income', s.income], ['Expenses', s.expenses], ['Net cash movement', s.balance], ['Customer credit due', s.creditReceivable]];
            if (this.canViewLoans()) cards.push(['Loans payable', s.loansPayable], ['Loans to collect', s.loansReceivable]);
            document.getElementById('acct-summary').innerHTML = cards.map(([label,n]) => `<div class="stat-card"><div class="stat-content"><div class="stat-value">${ui.formatCurrency(n || 0)}</div><div class="stat-label">${label}</div></div></div>`).join('');
            const headers = [
                {key:'date',label:'Date',format:v=>ui.formatDate(v)}, {key:'type',label:'Entry'}, {key:'category',label:'Category'},
                {key:'counterparty',label:'Customer / Counterparty'}, {key:'description',label:'Description'}, {key:'amount',label:'Amount',format:v=>ui.formatCurrency(v)},
                ...(!cashier ? [{key:'branch',label:'Branch',format:v=>v?.name || '-'}] : []),
                {key:'createdBy',label:'Recorded by',format:v=>v ? `${v.firstName || ''} ${v.lastName || ''}`.trim() : '-'},
                {key:'status',label:'Status',format:v=>ui.statusBadge(v)}
            ];
            const actions = this.canApprove() ? [
                {icon:'fa-check',title:'Approve',class:'text-success',condition:r=>r.status==='pending' && r.createdBy?._id !== auth.user._id,handler:'pageAccounting.approve'},
                {icon:'fa-times',title:'Reject',class:'text-danger',condition:r=>r.status==='pending' && r.createdBy?._id !== auth.user._id,handler:'pageAccounting.reject'}
            ] : [];
            document.getElementById('acct-table').innerHTML = this.entries.length ? ui.generateTable(headers,this.entries,{actions}) : ui.emptyState('No accounting entries match these filters','fa-book');
            if (!this.isCashier()) await this.loadFormalReport();
        } catch(err) { document.getElementById('acct-table').innerHTML = ui.errorState(err.message); }
    }
    showCreate() {
        const cashier = this.isCashier();
        const opts = this.branches.map(b=>`<option value="${utils.escapeHtml(b._id)}">${utils.escapeHtml(b.name)}</option>`).join('');
        const loanTypes = this.canViewLoans() ? '<option value="loan_received">Loan received</option><option value="loan_repayment">Loan repayment</option><option value="loan_issued">Loan issued</option><option value="loan_recovered">Loan recovered</option>' : '';
        const types = cashier
            ? `<option value="credit_sale">Customer credit sale (amount owed)</option><option value="credit_payment">Customer credit payment received</option><option value="expense">Branch expense (requires approval)</option>${loanTypes}`
            : `<option value="income">Income</option><option value="expense">Expense</option><option value="credit_sale">Customer credit sale (due)</option><option value="credit_payment">Customer credit payment</option>${loanTypes}`;
        ui.showModal(cashier ? 'Record customer activity or branch expense' : 'Record accounting entry', `<div class="form-group"><label>Entry type</label><select id="ac-type">${types}</select></div>
          <div class="form-group"><label>Category</label><input id="ac-category" required maxlength="80" placeholder="Customer credit, utilities, transport, rent…"></div>
          <div class="form-group"><label>Customer / counterparty</label><input id="ac-counterparty" maxlength="160" placeholder="Customer or payee name"></div>
          <div class="form-group"><label>Amount</label><input id="ac-amount" type="number" min="0.01" step="0.01" required></div>
          <div class="form-group"><label>Date</label><input id="ac-date" type="date" value="${new Date().toISOString().slice(0,10)}" required></div>
          ${auth.user.role==='employer'?`<div class="form-group"><label>Branch</label><select id="ac-branch" required>${opts}</select></div>`:''}
          <div class="form-group"><label>Receipt / reference number</label><input id="ac-reference" maxlength="120"></div><div class="form-group"><label>Notes</label><textarea id="ac-description" maxlength="500"></textarea></div>`,
          `<button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button><button class="btn btn-primary" onclick="pageAccounting.create()">Save Entry</button>`);
    }
    async create() {
        try {
            await accountingApi.create({type:document.getElementById('ac-type').value,category:document.getElementById('ac-category').value,amount:Number(document.getElementById('ac-amount').value),date:document.getElementById('ac-date').value,branchId:document.getElementById('ac-branch')?.value || auth.user.branch,reference:document.getElementById('ac-reference').value,counterparty:document.getElementById('ac-counterparty').value,description:document.getElementById('ac-description').value});
            ui.closeModal(); ui.showToast('success','Saved','Entry recorded'); await this.load();
        } catch(err) { ui.showToast('error','Could not save',err.message); }
    }
    async decide(i, status) {
        const entry=this.entries[i]; if(!entry) return;
        try { await accountingApi.decide(entry._id,status); ui.showToast('success',status==='approved'?'Expense approved':'Entry rejected','Decision recorded in the audit trail.'); await this.load(); }
        catch(err) { ui.showToast('error','Could not update entry',err.message); }
    }
    approve(i) { return this.decide(i,'approved'); }
    reject(i) { return this.decide(i,'rejected'); }
    async loadFormalReport() {
        const type = document.getElementById('ledger-report-type')?.value || 'trial-balance';
        const params = { branchId: this.filters().branchId, startDate: document.getElementById('ledger-start')?.value || '', endDate: document.getElementById('ledger-end')?.value || '' };
        try {
            const [report, pending, history] = await Promise.all([accountingApi.report(type, params), this.canApprove() ? accountingApi.journals({status:'pending'}) : Promise.resolve({entries:[]}), accountingApi.journals({status:'posted', ...params})]);
            this.formalReport = report;
            const result = document.getElementById('ledger-report-result');
            const rows = report.accounts || [];
            const headers = [{key:'code',label:'Code'},{key:'name',label:'Account'},{key:'accountType',label:'Type'},{key:'debitBalance',label:'Debit',format:v=>ui.formatCurrency(v)},{key:'creditBalance',label:'Credit',format:v=>ui.formatCurrency(v)}];
            const totals = report.totals || {};
            result.innerHTML = `<div class="stats-grid"><div class="stat-card"><div class="stat-content"><div class="stat-value">${ui.formatCurrency(totals.debits)}</div><div class="stat-label">Debit total</div></div></div><div class="stat-card"><div class="stat-content"><div class="stat-value">${ui.formatCurrency(totals.credits)}</div><div class="stat-label">Credit total</div></div></div>${type==='income-statement'?`<div class="stat-card"><div class="stat-content"><div class="stat-value">${ui.formatCurrency(totals.netIncome)}</div><div class="stat-label">Net income</div></div></div>`:''}${totals.inBalance !== null ? `<div class="stat-card"><div class="stat-content"><div class="stat-value">${totals.inBalance ? 'Balanced' : 'Out of balance'}</div><div class="stat-label">Ledger check</div></div></div>` : ''}</div>${ui.generateTable(headers,rows)}`;
            const pendingRows = pending.entries || [];
            const approvalActions = [{icon:'fa-check',title:'Post',class:'text-success',handler:'pageAccounting.decideJournalPosted'},{icon:'fa-times',title:'Reject',class:'text-danger',handler:'pageAccounting.decideJournalRejected'}];
            document.getElementById('ledger-pending-approvals').innerHTML = this.canApprove() && pendingRows.length ? `<h4>Journal entries awaiting approval</h4>${ui.generateTable([{key:'entryDate',label:'Date',format:v=>ui.formatDate(v)},{key:'memo',label:'Memo'},{key:'totalDebit',label:'Amount',format:v=>ui.formatCurrency(v)},{key:'createdBy',label:'Created by',format:v=>v?`${v.firstName||''} ${v.lastName||''}`:'-'}],pendingRows,{actions:approvalActions})}` : '';
            this.pendingJournals = pendingRows;
            const historyRows = history.entries || [];
            document.getElementById('ledger-journal-history').innerHTML = `<h4>Posted journal history</h4>${historyRows.length ? ui.generateTable([{key:'entryDate',label:'Date',format:v=>ui.formatDate(v)},{key:'memo',label:'Memo'},{key:'reference',label:'Reference'},{key:'source',label:'Source'},{key:'branch',label:'Branch',format:v=>v?.name||'-'},{key:'totalDebit',label:'Debits',format:v=>ui.formatCurrency(v)},{key:'totalCredit',label:'Credits',format:v=>ui.formatCurrency(v)}],historyRows) : '<p class="text-secondary">No posted journal entries in this date range.</p>'}`;
        } catch(err) { const result=document.getElementById('ledger-report-result'); if(result) result.innerHTML=ui.errorState(err.message); }
    }
    async decideJournal(index, status) {
        const entry = this.pendingJournals?.[index]; if (!entry) return;
        try { await accountingApi.decideJournal(entry._id || entry.id,status); ui.showToast('success','Journal updated',status==='posted'?'Entry posted to the ledger':'Entry rejected'); await this.loadFormalReport(); }
        catch(err) { ui.showToast('error','Could not update journal',err.message); }
    }
    decideJournalPosted(i) { return this.decideJournal(i,'posted'); }
    decideJournalRejected(i) { return this.decideJournal(i,'rejected'); }
    showJournalModal() {
        const accounts = this.ledgerAccounts || [];
        const accountOptions = accounts.map(a=>`<option value="${utils.escapeHtml(a.code)}">${utils.escapeHtml(a.code)} · ${utils.escapeHtml(a.name)}</option>`).join('');
        const branchOptions = this.branches.map(b=>`<option value="${utils.escapeHtml(b._id)}">${utils.escapeHtml(b.name)}</option>`).join('');
        ui.showModal('New double-entry journal', `<p class="text-secondary">Enter an equal debit and credit. Journal entries are immutable after posting; corrections require a reversing entry.</p><div class="form-group"><label>Branch</label>${auth.user.role==='employer'?`<select id="journal-branch">${branchOptions}</select>`:'<input value="Your assigned branch" disabled>'}</div><div class="form-group"><label>Date</label><input id="journal-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="form-group"><label>Memo</label><input id="journal-memo" maxlength="500" required></div><div class="form-group"><label>Reference</label><input id="journal-reference" maxlength="120"></div><div class="form-group"><label>Debit account</label><select id="journal-debit-account">${accountOptions}</select></div><div class="form-group"><label>Credit account</label><select id="journal-credit-account">${accountOptions}</select></div><div class="form-group"><label>Amount</label><input id="journal-amount" type="number" min="0.01" step="0.01"></div>`,`<button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button><button class="btn btn-primary" onclick="pageAccounting.createJournal()">Save journal</button>`);
    }
    async createJournal() {
        const amount = Number(document.getElementById('journal-amount').value);
        const debitCode = document.getElementById('journal-debit-account').value;
        const creditCode = document.getElementById('journal-credit-account').value;
        if (!amount || amount <= 0 || debitCode === creditCode) return ui.showToast('warning','Check journal','Enter a positive amount and select two different accounts.');
        try {
            await accountingApi.createJournal({branchId:document.getElementById('journal-branch')?.value || auth.user.branch,entryDate:document.getElementById('journal-date').value,memo:document.getElementById('journal-memo').value,reference:document.getElementById('journal-reference').value,lines:[{accountCode:debitCode,debit:amount,credit:0},{accountCode:creditCode,debit:0,credit:amount}]});
            ui.closeModal(); ui.showToast('success','Journal saved','Balanced journal entry recorded.'); await this.loadFormalReport();
        } catch(err) { ui.showToast('error','Could not save journal',err.message); }
    }
    downloadFormalReport() {
        if (!this.formalReport) return ui.showToast('warning','No report','Run a report before downloading.');
        const rows=[['Code','Account','Type','Debit balance','Credit balance'],...(this.formalReport.accounts||[]).map(a=>[a.code,a.name,a.accountType,a.debitBalance,a.creditBalance])];
        const csv=rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
        const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${this.formalReport.reportType}-${this.formalReport.asOf}.csv`;a.click();URL.revokeObjectURL(url);
    }
    async backfillLedger() {
        if (!confirm('Post all existing approved accounting entries to the double-entry ledger? This is idempotent; entries already posted will be skipped.')) return;
        try { const res=await accountingApi.backfill(); ui.showToast('success','Ledger backfill complete',`${res.result.posted} posted, ${res.result.alreadyPosted} already posted, ${res.result.failed.length} failed`); await this.loadFormalReport(); }
        catch(err) { ui.showToast('error','Backfill failed',err.message); }
    }
    async backfillReceipts() {
        if (!confirm('Post all existing confirmed receipts to the double-entry ledger? If these sales were already manually entered as accounting income, this may double count them. Back up and review first.')) return;
        try { const res=await accountingApi.backfill({includeReceipts:true}); ui.showToast('success','Receipt backfill complete',`${res.result.receiptsPosted} receipts posted, ${res.result.receiptsAlreadyPosted} already posted, ${res.result.failed.length} failed`); await this.loadFormalReport(); }
        catch(err) { ui.showToast('error','Receipt backfill failed',err.message); }
    }
    exportCsv() {
        const rows = [['Date','Type','Category','Customer / Counterparty','Description','Amount','Branch','Created by','Status'], ...this.entries.map(e => [e.date,e.type,e.category,e.counterparty,e.description,e.amount,e.branch?.name || '',`${e.createdBy?.firstName || ''} ${e.createdBy?.lastName || ''}`.trim(),e.status])];
        const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
        const a = document.createElement('a'); a.href = url; a.download = `accounting-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
    }
}
const pageAccounting = new AccountingPage();
