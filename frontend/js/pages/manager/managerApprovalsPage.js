class ManagerApprovalsPage {
    constructor() { this.withdrawals = []; }
    async render(container) {
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header"><h3><i class="fas fa-check-circle"></i> Withdrawals to Approve</h3></div>
                <div class="card-body"><div id="mgr-wd">${ui.loader()}</div></div>
            </div>
            <div class="card">
                <div class="card-header"><h3><i class="fas fa-users"></i> Team Attendance Today</h3></div>
                <div class="card-body"><div id="mgr-att">${ui.loader()}</div></div>
            </div>`;
        await Promise.all([this.loadWithdrawals(), this.loadAttendance()]);
    }
    async loadWithdrawals() {
        try {
            const res = await withdrawalsApi.list({ status: 'pending', limit: 100 });
            this.withdrawals = res.withdrawals || [];
            const c = document.getElementById('mgr-wd');
            if (!this.withdrawals.length) { c.innerHTML = ui.emptyState('No pending withdrawals', 'fa-check-circle'); return; }
            const headers = [
                { key: 'withdrawalId', label: 'ID' },
                { key: 'requesterName', label: 'From' },
                { key: 'totalItems', label: 'Items' },
                { key: 'status', label: 'Status', format: v => ui.statusBadge(v) }
            ];
            const actions = [
                { icon: 'fa-check', title: 'Approve', class: 'text-success', handler: 'pageManagerApprovals.approve' },
                { icon: 'fa-times', title: 'Reject', class: 'text-danger', handler: 'pageManagerApprovals.reject' }
            ];
            c.innerHTML = ui.generateTable(headers, this.withdrawals, { actions });
        } catch (err) { document.getElementById('mgr-wd').innerHTML = ui.errorState(err.message); }
    }
    approve(i) {
        const w = this.withdrawals[i];
        ui.confirm('Approve', `Approve ${w.withdrawalId}?`, async () => {
            try { await withdrawalsApi.approve(w._id, { comments: 'Approved' }); ui.showToast('success', 'Approved', 'Done'); this.loadWithdrawals(); }
            catch (err) { ui.showToast('error', 'Error', err.message); }
        });
    }
    reject(i) {
        const w = this.withdrawals[i];
        const content = `<div class="form-group"><label>Reason *</label><textarea id="rj" required></textarea></div>`;
        const footer = `<button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button><button class="btn btn-danger" onclick="pageManagerApprovals.doReject('${w._id}')">Reject</button>`;
        ui.showModal('Reject', content, footer);
    }
    async doReject(id) {
        try { await withdrawalsApi.reject(id, { reason: document.getElementById('rj').value }); ui.closeModal(); ui.showToast('success', 'Rejected', 'Done'); this.loadWithdrawals(); }
        catch (err) { ui.showToast('error', 'Error', err.message); }
    }
    async loadAttendance() {
        try {
            const res = await attendanceApi.today();
            document.getElementById('mgr-att').innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-icon success"><i class="fas fa-user-check"></i></div><div class="stat-content"><div class="stat-value">${res.present?.length || 0}</div><div class="stat-label">Present</div></div></div>
                    <div class="stat-card"><div class="stat-icon warning"><i class="fas fa-user-clock"></i></div><div class="stat-content"><div class="stat-value">${res.late?.length || 0}</div><div class="stat-label">Late</div></div></div>
                    <div class="stat-card"><div class="stat-icon danger"><i class="fas fa-user-times"></i></div><div class="stat-content"><div class="stat-value">${res.absent?.length || 0}</div><div class="stat-label">Absent</div></div></div>
                </div>`;
        } catch (err) { document.getElementById('mgr-att').innerHTML = ui.errorState(err.message); }
    }
}
const pageManagerApprovals = new ManagerApprovalsPage();
