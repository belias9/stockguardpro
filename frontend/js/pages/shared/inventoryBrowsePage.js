class InventoryBrowsePage {
    constructor() { this.items = []; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header"><h3><i class="fas fa-boxes"></i> Browse Inventory</h3></div>
                <div class="card-body">
                    <div class="search-bar mb-3">
                        <i class="fas fa-search"></i>
                        <input type="search" placeholder="Search..." oninput="pageInventoryBrowse.search(this.value)">
                    </div>
                    <div id="br-table">${ui.loader()}</div>
                </div>
            </div>`;
        await this.load();
    }

    async load() {
        try {
            const res = await inventoryApi.list({ limit: 200 });
            this.items = res.items || [];
            this.renderTable();
        } catch (err) { document.getElementById('br-table').innerHTML = ui.errorState(err.message); }
    }

    search(q) {
        clearTimeout(this._t);
        this._t = setTimeout(async () => {
            try { const res = await inventoryApi.list({ search: q, limit: 200 }); this.items = res.items || []; this.renderTable(); } catch {}
        }, 300);
    }

    renderTable() {
        const c = document.getElementById('br-table');
        if (!this.items.length) { c.innerHTML = ui.emptyState('No items', 'fa-box-open'); return; }
        const role = auth.user.role;
        const active = auth.user.activeRoles || [];
        const seesCost = role === 'employer' || active.includes('manager') || (active.includes('stock') && auth.user.isMainStock);
        const headers = [
            { key: 'itemCode', label: 'Code' },
            { key: 'name', label: 'Name' },
            { key: 'quantity', label: 'Qty', format: (v, r) => `${v} ${r.unit}` },
            { key: 'sellingPrice', label: 'Price', format: v => ui.formatCurrency(v) },
            { key: 'warehouse', label: 'Warehouse', format: v => v?.name || '-' }
        ];
        if (seesCost) headers.splice(3, 0, { key: 'unitCost', label: 'Cost', format: v => ui.formatCurrency(v) });
        c.innerHTML = ui.generateTable(headers, this.items, {});
    }
}
const pageInventoryBrowse = new InventoryBrowsePage();
