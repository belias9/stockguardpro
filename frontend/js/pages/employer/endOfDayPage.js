class EndOfDayPage {
    constructor() { this.data = null; }

    async render(container) {
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header"><h3><i class="fas fa-calendar-day"></i> End of Day Report</h3></div>
                <div class="card-body"><div id="eod-content">${ui.loader()}</div></div>
            </div>`;
        await this.load();
    }

    async load() {
        try {
            const [overview, structure] = await Promise.all([
                dashboardApi.overview(),
                dashboardApi.structureValue({})
            ]);
            this.data = { overview: overview.overview, structure };
            this.renderSections();
        } catch (err) { document.getElementById('eod-content').innerHTML = ui.errorState(err.message); }
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
            </div>`;
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
