class AuditPage {
    constructor() { this.logs = []; this.filters = {}; }

    async render(container) {
        container.innerHTML = `
            <div id="audit-summary" class="stats-grid mb-4">${ui.loader()}</div>
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-clipboard-list"></i> Audit Trail</h3>
                    <button class="btn btn-secondary" onclick="pageAudit.exportCsv()"><i class="fas fa-download"></i> Export</button>
                </div>
                <div class="card-body">
                    <div class="flex gap-2 mb-3 flex-wrap">
                        <select id="f-action" onchange="pageAudit.doFilter()" style="max-width:200px;">
                            <option value="">All Actions</option>
                            <option value="LOGIN">Login</option>
                            <option value="CREATE">Create</option>
                            <option value="UPDATE">Update</option>
                            <option value="DELETE">Delete</option>
                            <option value="WITHDRAWAL_REQUEST">Withdrawal Request</option>
                            <option value="WITHDRAWAL_APPROVE">Withdrawal Approve</option>
                            <option value="SALARY_PAY">Salary Pay</option>
                            <option value="PAYMENT_CONFIRM">Payment Confirm</option>
                        </select>
                        <select id="f-severity" onchange="pageAudit.doFilter()" style="max-width:200px;">
                            <option value="">All Severities</option>
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="critical">Critical</option>
                        </select>
                        <input type="date" id="f-start" onchange="pageAudit.doFilter()">
                        <input type="date" id="f-end" onchange="pageAudit.doFilter()">
                    </div>
                    <div id="audit-table">${ui.loader()}</div>
                </div>
            </div>
        `;
        await Promise.all([this.loadSummary(), this.load()]);
    }

    async loadSummary() {
        try {
            const res = await auditApi.summary({ days: 30 });
            const s = res.summary || {};
            document.getElementById('audit-summary').innerHTML = `
                ${this.statCard('primary', 'fa-list', s.totalActions || 0, 'Total Actions')}
                ${this.statCard('success', 'fa-check', s.successfulActions || 0, 'Successful')}
                ${this.statCard('danger', 'fa-times', s.failedActions || 0, 'Failed')}
                ${this.statCard('warning', 'fa-exclamation-triangle', s.criticalActions || 0, 'Critical')}
            `;
        } catch {}
    }

    statCard(color, icon, value, label) {
        return `<div class="stat-card"><div class="stat-icon ${color}"><i class="fas ${icon}"></i></div><div class="stat-content"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div></div>`;
    }

    async load() {
        try {
            const params = { limit: 100 };
            const a = document.getElementById('f-action')?.value;
            const s = document.getElementById('f-severity')?.value;
            const st = document.getElementById('f-start')?.value;
            const en = document.getElementById('f-end')?.value;
            if (a) params.action = a;
            if (s) params.severity = s;
            if (st) params.startDate = st;
            if (en) params.endDate = en;
            const res = await auditApi.list(params);
            this.logs = res.logs || [];
            this.renderTable();
        } catch (err) { document.getElementById('audit-table').innerHTML = ui.errorState(err.message); }
    }

    doFilter() { this.load(); }

    renderTable() {
        const c = document.getElementById('audit-table');
        if (!this.logs.length) { c.innerHTML = ui.emptyState('No logs', 'fa-clipboard-list'); return; }
        const headers = [
            { key: 'timestamp', label: 'Time', format: v => ui.formatDate(v, 'long') },
            { key: 'action', label: 'Action', format: v => `<span class="text-xs">${v.replace(/_/g, ' ')}</span>` },
            { key: 'entityType', label: 'Entity' },
            { key: 'entityName', label: 'Name', format: v => v || '-' },
            { key: 'performedByName', label: 'User' },
            { key: 'severity', label: 'Severity', format: v => `<span class="status-badge ${v === 'critical' ? 'rejected' : v === 'warning' ? 'pending' : 'completed'}">${v}</span>` }
        ];
        c.innerHTML = ui.generateTable(headers, this.logs, {});
    }

    async exportCsv() {
        try {
            const res = await auditApi.export({ format: 'csv' });
            // Server returns CSV text or JSON — just trigger download
            const blob = new Blob([JSON.stringify(res.data || res, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            ui.showToast('success', 'Export', 'Audit data downloaded');
        } catch (err) { ui.showToast('error', 'Export failed', err.message); }
    }
}

const pageAudit = new AuditPage();