class ShopBuyerPage {
    constructor() { this.preRecords = []; }
    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-shopping-cart"></i> My Purchases</h3>
                    <button class="btn btn-primary" onclick="pageShopBuyer.showCreate()"><i class="fas fa-plus"></i> Record Purchase</button>
                </div>
                <div class="card-body"><div id="sb-table">${ui.loader()}</div></div>
            </div>`;
        await this.load();
    }
    async load() {
        try {
            const res = await preRecordApi.list({ limit: 100 });
            this.preRecords = res.preRecords || [];
            const c = document.getElementById('sb-table');
            if (!this.preRecords.length) { c.innerHTML = ui.emptyState('No purchases yet', 'fa-shopping-cart'); return; }
            const headers = [
                { key: 'preRecordId', label: 'ID' },
                { key: 'totalItems', label: 'Items' },
                { key: 'totalCost', label: 'Cost', format: v => ui.formatCurrency(v) },
                { key: 'status', label: 'Status', format: v => ui.statusBadge(v) },
                { key: 'purchaseDate', label: 'Date', format: v => ui.formatDate(v) }
            ];
            c.innerHTML = ui.generateTable(headers, this.preRecords, {});
        } catch (err) { document.getElementById('sb-table').innerHTML = ui.errorState(err.message); }
    }
    async showCreate() {
        const whRes = await warehousesApi.list({});
        const whs = whRes.warehouses || [];
        const content = `
            <form id="sb-form">
                <div class="form-group"><label>Warehouse *</label><select id="sb-wh" required>${whs.map(w => `<option value="${w._id}">${w.name}</option>`).join('')}</select></div>
                <div class="form-group"><label>Supplier</label><input type="text" id="sb-supp"></div>
                <div id="sb-items">
                    <div class="sb-item grid-4 gap-2 mb-2">
                        <div class="form-group"><label>Code</label><input type="text" class="p-code"></div>
                        <div class="form-group"><label>Name</label><input type="text" class="p-name"></div>
                        <div class="form-group"><label>Qty</label><input type="number" class="p-qty" min="0"></div>
                        <div class="form-group"><label>Cost</label><input type="number" class="p-cost" step="0.01"></div>
                    </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="pageShopBuyer.addRow()">+ Add Item</button>
                <div class="form-group mt-3"><label>Receipt Image URL *</label><input type="url" id="sb-img" required></div>
            </form>`;
        const footer = `<button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button><button class="btn btn-primary" onclick="pageShopBuyer.create()">Save</button>`;
        ui.showModal('New Purchase', content, footer);
    }
    addRow() {
        const c = document.getElementById('sb-items');
        const row = document.createElement('div');
        row.className = 'sb-item grid-4 gap-2 mb-2';
        row.innerHTML = `<div class="form-group"><label>Code</label><input type="text" class="p-code"></div><div class="form-group"><label>Name</label><input type="text" class="p-name"></div><div class="form-group"><label>Qty</label><input type="number" class="p-qty" min="0"></div><div class="form-group"><label>Cost</label><input type="number" class="p-cost" step="0.01"></div>`;
        c.appendChild(row);
    }
    async create() {
        const items = [];
        document.querySelectorAll('.sb-item').forEach(row => {
            const code = row.querySelector('.p-code').value;
            const name = row.querySelector('.p-name').value;
            const qty = parseFloat(row.querySelector('.p-qty').value) || 0;
            const cost = parseFloat(row.querySelector('.p-cost').value) || 0;
            if (code && name && qty > 0) items.push({ itemCode: code.toUpperCase(), itemName: name, category: 'other', unit: 'pieces', quantity: qty, unitCost: cost });
        });
        if (!items.length) { ui.showToast('warning', 'Validation', 'Add at least one item'); return; }
        try {
            await preRecordApi.create({ warehouseId: document.getElementById('sb-wh').value, items, receiptImageUrl: document.getElementById('sb-img').value, supplier: { name: document.getElementById('sb-supp').value } });
            ui.closeModal(); ui.showToast('success', 'Created', 'Purchase recorded'); this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
}
const pageShopBuyer = new ShopBuyerPage();
