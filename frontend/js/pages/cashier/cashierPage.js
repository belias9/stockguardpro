class CashierPage {
    constructor() { this.pending = []; }
    async render(container) {
        container.innerHTML = `
            <div class="stats-grid mb-4" id="cash-stats">${ui.loader()}</div>
            <div class="card">
                <div class="card-header"><h3><i class="fas fa-money-bill"></i> Pending Payments</h3></div>
                <div class="card-body"><div id="cash-table">${ui.loader()}</div></div>
            </div>`;
        await Promise.all([this.loadSession(), this.loadPending()]);
    }
    async loadSession() {
        try {
            const res = await cashierApi.getSession();
            const s = res.session || {};
            document.getElementById('cash-stats').innerHTML = `
                <div class="stat-card"><div class="stat-icon primary"><i class="fas fa-receipt"></i></div><div class="stat-content"><div class="stat-value">${s.totals?.transactionCount || 0}</div><div class="stat-label">Transactions</div></div></div>
                <div class="stat-card"><div class="stat-icon success"><i class="fas fa-money-bill"></i></div><div class="stat-content"><div class="stat-value">${ui.formatCurrency(s.totals?.totalReceived || 0)}</div><div class="stat-label">Received</div></div></div>
                <div class="stat-card"><div class="stat-icon warning"><i class="fas fa-exclamation-triangle"></i></div><div class="stat-content"><div class="stat-value">${s.totals?.disputedCount || 0}</div><div class="stat-label">Disputed</div></div></div>`;
        } catch {}
    }
    async loadPending() {
        try {
            const res = await cashierApi.getPending();
            this.pending = res.receipts || [];
            const c = document.getElementById('cash-table');
            if (!this.pending.length) { c.innerHTML = ui.emptyState('No pending payments', 'fa-check-circle'); return; }
            const headers = [
                { key: 'receiptId', label: 'Receipt' },
                { key: 'totalAmount', label: 'Amount', format: v => ui.formatCurrency(v) },
                { key: 'paymentMethod', label: 'Method' }
            ];
            const actions = [
                { icon: 'fa-check', title: 'Confirm', class: 'text-success', handler: 'pageCashier.confirm' },
                { icon: 'fa-times', title: 'Dispute', class: 'text-danger', handler: 'pageCashier.dispute' }
            ];
            c.innerHTML = ui.generateTable(headers, this.pending, { actions });
        } catch (err) { document.getElementById('cash-table').innerHTML = ui.errorState(err.message); }
    }
    confirm(i) {
        const r = this.pending[i];
        ui.confirm('Confirm', `Confirm ${ui.formatCurrency(r.totalAmount)} received?`, async () => {
            try { await cashierApi.confirm(r._id, { notes: 'Confirmed' }); ui.showToast('success', 'Confirmed', 'Done'); this.loadSession(); this.loadPending(); }
            catch (err) { ui.showToast('error', 'Error', err.message); }
        });
    }
    dispute(i) {
        const r = this.pending[i];
        const content = `<div class="form-group"><label>Reason *</label><textarea id="dr" required></textarea></div>`;
        const footer = `<button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button><button class="btn btn-danger" onclick="pageCashier.doDispute('${r._id}')">Dispute</button>`;
        ui.showModal('Dispute', content, footer);
    }
    async doDispute(id) {
        try { await cashierApi.dispute(id, { reason: document.getElementById('dr').value }); ui.closeModal(); ui.showToast('success', 'Disputed', 'Done'); this.loadPending(); }
        catch (err) { ui.showToast('error', 'Error', err.message); }
    }
}
const pageCashier = new CashierPage();
