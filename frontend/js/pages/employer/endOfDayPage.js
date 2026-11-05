class EndOfDayPage {
    constructor() { this.data = null; }
    isManager() { return auth.user?.role === 'employee' && auth.user.activeRoles?.includes('manager'); }

    async render(container) {
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header"><h3><i class="fas fa-calendar-day"></i> ${this.isManager() ? 'Branch End-of-Day Report' : 'End of Day Report'}</h3></div>
                <div class="card-body">${this.isManager() ? '<p class="text-secondary">Saved reports for your branch. The employer controls which sections managers can see.</p>' : ''}<div id="eod-content">${ui.loader()}</div></div>
            </div>`;
        await this.load();
    }

    async load() {
        try {
            if (this.isManager()) {
                const saved = await api.get('/end-of-day?limit=30');
                this.savedReports = saved.reports || [];
                this.renderManagerReports();
                return;
            }
            const [overview, structure, saved] = await Promise.all([
                dashboardApi.overview(),
                dashboardApi.structureValue({}),
                api.get('/end-of-day?limit=30')
            ]);
            this.data = { overview: overview.overview, structure };
            this.savedReports = saved.reports || [];
            this.renderSections();
        } catch (err) { document.getElementById('eod-content').innerHTML = ui.errorState(err.message); }
    }

    renderManagerReports() {
        const labels = { goodsBought: 'Goods bought', attendance: 'Attendance', cashier: 'Branch sales and cashier totals', transfers: 'Transfers', inventoryAlerts: 'Inventory alerts', faultyGoods: 'Outstanding goods', aiInsights: 'AI insights' };
        const rows = (this.savedReports || []).map((report, i) => {
            const keys = Object.keys(labels).filter(key => report[key] && Object.keys(report[key]).length);
            return `<details class="card mb-2"><summary class="card-header">${utils.escapeHtml(report.reportDate || '')} · ${utils.escapeHtml(report.branch?.name || 'Your branch')}</summary><div class="card-body"><div class="grid-2 gap-2">${keys.map(key => `<section class="card"><div class="card-header"><strong>${labels[key]}</strong><button class="btn btn-sm btn-secondary" onclick="pageEndOfDay.downloadSavedSection(${i},'${key}')">Download</button></div><div class="card-body"><pre class="text-sm">${utils.escapeHtml(JSON.stringify(report[key], null, 2))}</pre></div></section>`).join('') || '<p>No sections have been enabled for managers. Ask your employer to choose sections in Settings.</p>'}</div><button class="btn btn-primary mt-2" onclick="pageEndOfDay.downloadSavedFull(${i})">Download full visible report</button></div></details>`;
        }).join('');
        document.getElementById('eod-content').innerHTML = rows || '<p class="text-secondary">No saved report is available for your branch yet.</p>';
    }

    renderSections() {
        const o = this.data.overview;
        const s = this.data.structure;
        const sales = s.sales || {};

        document.getElementById('eod-content').innerHTML = `
            <div class="grid-2 gap-3">
                ${this.section('Cashier', 'fa-money-bill', [
                    { label: 'Transactions', value: sales.transactionCount || 0 },
                    { label: 'Total Sold', value: ui.formatCurrency(sales.totalSold || 0) },
                    { label: 'Profit', value: ui.formatCurrency(sales.profit || 0) },
                    { label: 'Margin', value: (sales.profitMargin || 0).toFixed(1) + '%' }
                ])}
                ${this.section('Inventory', 'fa-boxes', [
                    { label: 'Total Items', value: o.inventory.totalItems },
                    { label: 'Low Stock', value: o.inventory.lowStock },
                    { label: 'Value', value: ui.formatCurrency(o.inventory.totalValue) }
                ])}
                ${this.section('Attendance', 'fa-fingerprint', [
                    { label: 'Present', value: o.attendance.presentToday },
                    { label: 'Absent', value: o.attendance.absentToday },
                    { label: 'Rate', value: o.attendance.attendanceRate + '%' }
                ])}
                ${this.section('Withdrawals', 'fa-dolly', [
                    { label: 'Pending', value: o.withdrawals.pending },
                    { label: 'Today', value: o.withdrawals.today }
                ])}
                ${this.section('Payroll', 'fa-money-bill-wave', [
                    { label: 'Pending Payments', value: o.salary.pendingPayments },
                    { label: 'Disputed', value: o.salary.disputed }
                ])}
                ${this.section('Messages', 'fa-envelope', [
                    { label: 'Unread', value: o.communication.unreadMessages },
                    { label: 'Complaints', value: o.communication.pendingComplaints }
                ])}
            </div>
            <div class="mt-4 flex gap-2">
                <button class="btn btn-primary" onclick="pageEndOfDay.downloadFull()">
                    <i class="fas fa-download"></i> Download Full Report
                </button>
                <button class="btn btn-secondary" onclick="pageEndOfDay.refresh()">
                    <i class="fas fa-sync"></i> Refresh
                </button>
                <button class="btn btn-primary" onclick="pageEndOfDay.generateNow()"><i class="fas fa-file-alt"></i> Generate today's branch reports</button>
            </div>`;
        this.renderSavedReports();
    }

    renderSavedReports() {
        const existing = document.getElementById('saved-eod-reports');
        if (existing) existing.remove();
        const wrap = document.createElement('div'); wrap.id = 'saved-eod-reports'; wrap.className = 'card mt-4';
        wrap.innerHTML = `<div class="card-header"><h3>Generated End-of-Day Reports</h3></div><div class="card-body">${(this.savedReports || []).map((report, i) => {
            const sections = ['goodsBought','attendance','cashier','transfers','inventoryAlerts','faultyGoods','aiInsights'];
            return `<details class="card mb-2"><summary class="card-header">${utils.escapeHtml(report.reportDate || '')} · ${utils.escapeHtml(report.branch?.name || 'Branch')} · ${utils.escapeHtml(report.delivery?.status || '')}</summary><div class="card-body"><div class="grid-2 gap-2">${sections.filter(k=>report[k] && Object.keys(report[k]).length).map(k=>`<section class="card"><div class="card-header"><strong>${k}</strong><button class="btn btn-sm btn-secondary" onclick="pageEndOfDay.downloadSavedSection(${i},'${k}')">Download</button></div><div class="card-body"><pre class="text-sm">${utils.escapeHtml(JSON.stringify(report[k],null,2))}</pre></div></section>`).join('')}</div><button class="btn btn-primary mt-2" onclick="pageEndOfDay.downloadSavedFull(${i})">Download full report</button></div></details>`;
        }).join('') || '<p>No saved reports yet. Use Generate or wait for the configured daily time.</p>'}</div>`;
        document.getElementById('eod-content')?.appendChild(wrap);
    }

    async generateNow() {
        try { const result = await api.post('/end-of-day/generate', {}); this.savedReports = result.reports || []; this.renderSavedReports(); ui.showToast('success','Reports generated',`${this.savedReports.length} branch report(s) saved`); }
        catch (err) { ui.showToast('error','Could not generate report',err.message); }
    }

    downloadSavedSection(index, key) { this.downloadJsonCsv(`${key}_${this.savedReports[index]?.reportDate || 'report'}`, this.savedReports[index]?.[key] || {}); }
    downloadSavedFull(index) { this.downloadJsonCsv(`EOD_${this.savedReports[index]?.reportDate || 'report'}`, this.savedReports[index] || {}); }
    downloadJsonCsv(filename, value) {
        const rows = Object.entries(value).map(([key, val]) => [key, typeof val === 'object' ? JSON.stringify(val) : val]);
        const csv = rows.map(row=>row.map(v=>`"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
        const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`${filename}.csv`;a.click();URL.revokeObjectURL(a.href);
    }

    section(title, icon, rows) {
        const rowsHtml = rows.map(r => `
            <div class="flex justify-between py-1">
                <span class="text-sm text-secondary">${r.label}</span>
                <span class="text-sm font-semibold">${r.value}</span>
            </div>`).join('');
        return `<div class="card">
            <div class="card-header">
                <h4><i class="fas ${icon}"></i> ${title}</h4>
                <button class="btn btn-sm btn-secondary" onclick="pageEndOfDay.downloadSection('${title}', ${JSON.stringify(rows).replace(/"/g, '&quot;')})">
                    <i class="fas fa-download"></i>
                </button>
            </div>
            <div class="card-body">${rowsHtml}</div>
        </div>`;
    }

    downloadSection(title, rows) {
        let csv = `Section,${title}\nMetric,Value\n`;
        rows.forEach(r => csv += `"${r.label}","${r.value}"\n`);
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${title.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        ui.showToast('success', 'Downloaded', title + ' report');
    }

    downloadFull() {
        const o = this.data.overview;
        const s = this.data.structure;
        const sales = s.sales || {};
        
        let csv = `StockGuardPro — End of Day Report\n${new Date().toLocaleString()}\n\n`;
        csv += `CASHIER\nTransactions,${sales.transactionCount || 0}\nTotal Sold,${sales.totalSold || 0}\nProfit,${sales.profit || 0}\nMargin,${sales.profitMargin || 0}%\n\n`;
        csv += `INVENTORY\nTotal Items,${o.inventory.totalItems}\nLow Stock,${o.inventory.lowStock}\nValue,${o.inventory.totalValue}\n\n`;
        csv += `ATTENDANCE\nPresent,${o.attendance.presentToday}\nAbsent,${o.attendance.absentToday}\nRate,${o.attendance.attendanceRate}%\n\n`;
        csv += `WITHDRAWALS\nPending,${o.withdrawals.pending}\nToday,${o.withdrawals.today}\n\n`;
        csv += `PAYROLL\nPending,${o.salary.pendingPayments}\nDisputed,${o.salary.disputed}\n\n`;
        csv += `MESSAGES\nUnread,${o.communication.unreadMessages}\nComplaints,${o.communication.pendingComplaints}\n`;
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `EOD_Full_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        ui.showToast('success', 'Downloaded', 'Full EOD report');
    }

    refresh() { this.load(); }
}
const pageEndOfDay = new EndOfDayPage();
