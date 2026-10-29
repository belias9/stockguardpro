class StockOpsPage {
    constructor() { this.items = []; }
    async render(container) {
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header">
                    <h3><i class="fas fa-boxes"></i> Stock Operations</h3>
                    <button class="btn btn-primary" onclick="pageStockOps.showCreate()"><i class="fas fa-plus"></i> Add Item</button>
                </div>
                <div class="card-body">
                    <div class="search-bar mb-3"><i class="fas fa-search"></i><input type="search" placeholder="Search..." oninput="pageStockOps.search(this.value)"></div>
                    <div id="stock-table">${ui.loader()}</div>
                </div>
            </div>`;
        await this.load();
    }
    async load() {
        try {
            const res = await inventoryApi.list({ limit: 100 });
            this.items = res.items || [];
            this.renderTable();
        } catch (err) { document.getElementById('stock-table').innerHTML = ui.errorState(err.message); }
    }
    search(q) {
        clearTimeout(this._t);
        this._t = setTimeout(async () => {
            try { const res = await inventoryApi.list({ search: q, limit: 100 }); this.items = res.items || []; this.renderTable(); } catch {}
        }, 300);
    }
    renderTable() {
        const c = document.getElementById('stock-table');
        if (!this.items.length) { c.innerHTML = ui.emptyState('No items', 'fa-box-open'); return; }
        const headers = [
            { key: 'itemCode', label: 'Code' },
            { key: 'name', label: 'Name' },
            { key: 'quantity', label: 'Qty', format: (v, r) => `<span class="${v <= r.reorderPoint ? 'text-danger' : ''}">${v} ${r.unit}</span>` },
            { key: 'warehouse', label: 'Warehouse', format: v => v?.name || '-' }
        ];
        const actions = [{ icon: 'fa-sliders-h', title: 'Adjust', class: 'text-warning', handler: 'pageStockOps.showAdjust' }];
        c.innerHTML = ui.generateTable(headers, this.items, { actions });
    }
    async showCreate() {
        const whRes = await warehousesApi.list({});
        const whs = whRes.warehouses || [];
        if (!whs.length) { ui.showToast('warning', 'No warehouses', 'Create a warehouse first'); return; }
        const content = `
            <form id="stk-form">
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Code *</label><input type="text" id="s-code" required></div>
                    <div class="form-group"><label>Name *</label><input type="text" id="s-name" required></div>
                </div>
                <div class="form-group"><label>Warehouse *</label><select id="s-wh" required>${whs.map(w => `<option value="${w._id}">${w.name}</option>`).join('')}</select></div>
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Category *</label><input type="text" id="s-cat" required placeholder="electronics"></div>
                    <div class="form-group"><label>Unit *</label><input type="text" id="s-unit" required placeholder="pieces"></div>
                </div>
                <div class="grid-3 gap-3">
                    <div class="form-group"><label>Qty *</label><input type="number" id="s-qty" required min="0"></div>
                    <div class="form-group"><label>Cost *</label><input type="number" id="s-cost" required step="0.01"></div>
                    <div class="form-group"><label>Price</label><input type="number" id="s-price" step="0.01"></div>
                </div>
            </form>`;
        const footer = `<button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button><button class="btn btn-primary" onclick="pageStockOps.create()">Create</button>`;
        ui.showModal('Add Item', content, footer);
    }
    async create() {
        try {
            await inventoryApi.create({
                warehouseId: document.getElementById('s-wh').value,
                itemCode: document.getElementById('s-code').value.toUpperCase(),
                name: document.getElementById('s-name').value,
                category: document.getElementById('s-cat').value.toLowerCase(),
                unit: document.getElementById('s-unit').value.toLowerCase(),
                quantity: parseFloat(document.getElementById('s-qty').value),
                unitCost: parseFloat(document.getElementById('s-cost').value),
                sellingPrice: parseFloat(document.getElementById('s-price').value) || 0
            });
            ui.closeModal(); ui.showToast('success', 'Created', 'Item added'); this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
    showAdjust(index) {
        const it = this.items[index];
        if (!it) return;
        const content = `<p class="mb-3"><strong>${it.name}</strong> | Current: ${it.quantity} ${it.unit}</p>
            <div class="form-group"><label>Adjustment (+/-) *</label><input type="number" id="a-q" required step="0.01"></div>
            <div class="form-group"><label>Reason *</label><textarea id="a-r" required></textarea></div>`;
        const footer = `<button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button><button class="btn btn-warning" onclick="pageStockOps.doAdjust('${it._id}')">Adjust</button>`;
        ui.showModal('Adjust Stock', content, footer);
    }
    async doAdjust(id) {
        try {
            await inventoryApi.adjust(id, { adjustment: parseFloat(document.getElementById('a-q').value), reason: document.getElementById('a-r').value });
            ui.closeModal(); ui.showToast('success', 'Adjusted', 'Stock updated'); this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
}
const pageStockOps = new StockOpsPage();
