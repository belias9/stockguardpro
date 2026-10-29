class LowStockPage {
    async render(container) {
        container.innerHTML = `<div class="card"><div class="card-header"><h3><i class="fas fa-exclamation-triangle"></i> Low Stock</h3></div><div class="card-body"><div id="low-table">${ui.loader()}</div></div></div>`;
        await this.load();
    }

    async load() {
        try {
            const res = await inventoryApi.lowStock();
            const items = res.items || [];
            const c = document.getElementById('low-table');
            if (!items.length) {
                c.innerHTML = `<div class="text-center p-5"><i class="fas fa-check-circle fa-3x text-success mb-3"></i><p class="text-success">All items well stocked!</p></div>`;
                return;
            }
            const headers = [
                { key: 'itemCode', label: 'Code' },
                { key: 'name', label: 'Name' },
                { key: 'quantity', label: 'Qty', format: v => `<span class="text-danger font-bold">${v}</span>` },
                { key: 'reorderPoint', label: 'Reorder At' },
                { key: 'warehouse', label: 'Warehouse', format: v => v?.name || '-' }
            ];
            c.innerHTML = ui.generateTable(headers, items, {});
        } catch (err) { document.getElementById('low-table').innerHTML = ui.errorState(err.message); }
    }
}

const pageLowStock = new LowStockPage();