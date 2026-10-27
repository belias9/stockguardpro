class CustomersPage {
    constructor() { this.customers = []; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-user-friends"></i> Customers</h3>
                    <div class="search-bar" style="max-width:300px;">
                        <i class="fas fa-search"></i>
                        <input type="search" placeholder="Search by name/phone..." oninput="pageCustomers.search(this.value)">
                    </div>
                </div>
                <div class="card-body"><div id="cust-table">${ui.loader()}</div></div>
            </div>
        `;
        await this.load();
    }

    async load() {
        try {
            const res = await customersApi.list({ limit: 100 });
            this.customers = res.customers || [];
            this.renderTable();
        } catch (err) { document.getElementById('cust-table').innerHTML = ui.errorState(err.message); }
    }

    search(q) {
        clearTimeout(this._t);
        this._t = setTimeout(async () => {
            try {
                const res = await customersApi.list({ search: q, limit: 100 });
                this.customers = res.customers || [];
                this.renderTable();
            } catch {}
        }, 300);
    }

    renderTable() {
        const c = document.getElementById('cust-table');
        if (!this.customers.length) { c.innerHTML = ui.emptyState('No customers', 'fa-user-friends'); return; }
        const headers = [
            { key: 'name', label: 'Name' },
            { key: 'phone', label: 'Phone' },
            { key: 'totalOrders', label: 'Orders' },
            { key: 'totalSpent', label: 'Spent', format: v => ui.formatCurrency(v || 0) },
            { key: 'lastOrderAt', label: 'Last Order', format: v => v ? ui.formatDate(v) : '-' }
        ];
        const actions = [
            { icon: 'fa-eye', title: 'View', class: 'text-primary', handler: 'pageCustomers.showDetail' }
        ];
        c.innerHTML = ui.generateTable(headers, this.customers, { actions });
    }

    showDetail(index) {
        const c = this.customers[index];
        if (!c) return;
        const conv = (c.conversationLog || []).slice(-10).map(cv => `
            <div class="p-2 mb-1 rounded" style="background:var(--bg-primary);font-size:0.8rem;">
                <strong>${cv.type}:</strong> ${cv.message}
                <span class="text-muted text-xs">${ui.formatDate(cv.timestamp, 'long')}</span>
            </div>
        `).join('') || '<p class="text-muted text-sm">No conversations</p>';
        ui.showModal(c.name, `
            <div class="mb-3">
                <p class="text-sm"><strong>Phone:</strong> ${c.phone}</p>
                <p class="text-sm"><strong>Email:</strong> ${c.email || '-'}</p>
                <p class="text-sm"><strong>Orders:</strong> ${c.totalOrders || 0}</p>
                <p class="text-sm"><strong>Total Spent:</strong> ${ui.formatCurrency(c.totalSpent || 0)}</p>
            </div>
            <h4 class="mb-2">Recent Conversations</h4>
            ${conv}
        `);
    }
}

const pageCustomers = new CustomersPage();