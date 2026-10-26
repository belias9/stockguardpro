class WithdrawalsPage {
    constructor() { this.withdrawals = []; this.filter = ''; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-dolly"></i> Withdrawals</h3>
                    <select id="wd-filter" onchange="pageWithdrawals.doFilter(this.value)" style="max-width:200px;">
                        <option value="">All</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="in_transit">In Transit</option>
                        <option value="completed">Completed</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
                <div class="card-body"><div id="wd-table">${ui.loader()}</div></div>
            </div>
        `;
        await this.load();
    }

    async load() {
        try {
            const params = { limit: 100 };
            if (this.filter) params.status = this.filter;
            const res = await withdrawalsApi.list(params);
            this.withdrawals = res.withdrawals || [];
            this.renderTable();
        } catch (err) { document.getElementById('wd-table').innerHTML = ui.errorState(err.message); }
    }

    doFilter(v) { this.filter = v; this.load(); }

    renderTable() {
        const c = document.getElementById('wd-table');
        if (!this.withdrawals.length) { c.innerHTML = ui.emptyState('No withdrawals', 'fa-clipboard-list'); return; }
        const headers = [
            { key: 'withdrawalId', label: 'ID' },
            { key: 'requesterName', label: 'Requested By' },
            { key: 'sourceBranch', label: 'From', format: v => v?.name || '-' },
            { key: 'destinationBranch', label: 'To', format: v => v?.name || '-' },
            { key: 'totalItems', label: 'Items' },
            { key: 'status', label: 'Status', format: v => ui.statusBadge(v) },
            { key: 'createdAt', label: 'Date', format: v => ui.formatDate(v) }
        ];
        const actions = [
            { icon: 'fa-check', title: 'Approve', class: 'text-success', condition: r => r.status === 'pending', handler: 'pageWithdrawals.showApprove' },
            { icon: 'fa-times', title: 'Reject', class: 'text-danger', condition: r => r.status === 'pending', handler: 'pageWithdrawals.showReject' }
        ];
        c.innerHTML = ui.generateTable(headers, this.withdrawals, { actions });
    }

    showApprove(index) {
        const w = this.withdrawals[index];
        ui.confirm('Approve Withdrawal', `Approve ${w.withdrawalId}?`, async () => {
            try { await withdrawalsApi.approve(w._id, { comments: 'Approved' }); ui.showToast('success', 'Approved', 'Withdrawal approved'); this.load(); }
            catch (err) { ui.showToast('error', 'Error', err.message); }
        });
    }

    showReject(index) {
        const w = this.withdrawals[index];
        const content = `<form id="rej"><div class="form-group"><label>Reason *</label><textarea id="rej-r" required></textarea></div></form>`;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-danger" onclick="pageWithdrawals.doReject('${w._id}')">Reject</button>
        `;
        ui.showModal('Reject', content, footer);
    }

    async doReject(id) {
        try {
            await withdrawalsApi.reject(id, { reason: document.getElementById('rej-r').value });
            ui.closeModal();
            ui.showToast('success', 'Rejected', 'Withdrawal rejected');
            this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
}

const pageWithdrawals = new WithdrawalsPage();