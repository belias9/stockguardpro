class ReportsPage {
    async render(container) {
        container.innerHTML = `
            <div class="grid-2 mb-4">
                <div class="card">
                    <div class="card-header"><h3><i class="fas fa-coins"></i> Company Value</h3></div>
                    <div class="card-body"><div id="company-value">${ui.loader()}</div></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3><i class="fas fa-warehouse"></i> Structure Value</h3></div>
                    <div class="card-body"><div id="structure-value">${ui.loader()}</div></div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-chart-pie"></i> Sales & Profit</h3>
                    <div class="flex gap-2">
                        <input type="date" id="r-start">
                        <input type="date" id="r-end">
                        <button class="btn btn-primary btn-sm" onclick="pageReports.loadStructure()">Apply</button>
                    </div>
                </div>
                <div class="card-body"><div id="sales-summary">${ui.loader()}</div></div>
            </div>
        `;
        await Promise.all([this.loadCompany(), this.loadStructure()]);
    }

    async loadCompany() {
        try {
            const res = await dashboardApi.companyValue();
            const d = res.inventory || {};
            document.getElementById('company-value').innerHTML = `
                <div class="stat-card mb-2">
                    <div class="stat-icon primary"><i class="fas fa-boxes"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">${ui.formatCurrency(d.costValue || 0)}</div>
                        <div class="stat-label">Inventory Cost Value</div>
                    </div>
                </div>
                <div class="stat-card mb-2">
                    <div class="stat-icon success"><i class="fas fa-tag"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">${ui.formatCurrency(d.sellingValue || 0)}</div>
                        <div class="stat-label">Selling Value</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon info"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">${ui.formatCurrency(d.potentialProfit || 0)}</div>
                        <div class="stat-label">Potential Profit</div>
                    </div>
                </div>
            `;
        } catch (err) { document.getElementById('company-value').innerHTML = ui.errorState(err.message); }
    }

    async loadStructure() {
        try {
            const params = {};
            const s = document.getElementById('r-start')?.value;
            const e = document.getElementById('r-end')?.value;
            if (s) params.startDate = s;
            if (e) params.endDate = e;
            const res = await dashboardApi.structureValue(params);

            const structures = res.structures || [];
            const structuresHtml = structures.map(s => `
                <div class="p-2 mb-2 rounded" style="background:var(--bg-primary);">
                    <p class="text-sm font-semibold">${s.warehouse?.name || s.warehouse}</p>
                    <p class="text-xs">Items: ${s.itemCount} | Cost: ${ui.formatCurrency(s.stockValue)} | Profit: ${ui.formatCurrency(s.potentialProfit)}</p>
                </div>
            `).join('') || '<p class="text-muted text-sm">No data</p>';
            document.getElementById('structure-value').innerHTML = structuresHtml;

            const sales = res.sales || {};
            document.getElementById('sales-summary').innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon primary"><i class="fas fa-receipt"></i></div>
                        <div class="stat-content"><div class="stat-value">${sales.transactionCount || 0}</div><div class="stat-label">Transactions</div></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon success"><i class="fas fa-money-bill"></i></div>
                        <div class="stat-content"><div class="stat-value">${ui.formatCurrency(sales.totalSold || 0)}</div><div class="stat-label">Total Sold</div></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon info"><i class="fas fa-chart-line"></i></div>
                        <div class="stat-content"><div class="stat-value">${ui.formatCurrency(sales.profit || 0)}</div><div class="stat-label">Profit</div></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon warning"><i class="fas fa-percentage"></i></div>
                        <div class="stat-content"><div class="stat-value">${(sales.profitMargin || 0).toFixed(1)}%</div><div class="stat-label">Margin</div></div>
                    </div>
                </div>
            `;
        } catch (err) {
            document.getElementById('structure-value').innerHTML = ui.errorState(err.message);
            document.getElementById('sales-summary').innerHTML = ui.errorState(err.message);
        }
    }
}

const pageReports = new ReportsPage();