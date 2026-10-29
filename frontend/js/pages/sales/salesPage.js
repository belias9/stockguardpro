class SalesPage {
    constructor() { this.receipts = []; }
    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-receipt"></i> My Sales</h3>
                    <button class="btn btn-primary" onclick="pageSales.showCreate()"><i class="fas fa-plus"></i> New Receipt</button>
                </div>
                <div class="card-body"><div id="sales-table">${ui.loader()}</div></div>
            </div>`;
        await this.load();
    }
    async load() {
        try {
            const res = await receiptsApi.list({ limit: 100 });
            this.receipts = res.receipts || [];
            const c = document.getElementById('sales-table');
            if (!this.receipts.length) { c.innerHTML = ui.emptyState('No sales yet', 'fa-receipt'); return; }
            const headers = [
                { key: 'receiptId', label: 'Receipt' },
                { key: 'customer', label: 'Customer', format: v => v?.name || '-' },
                { key: 'totalAmount', label: 'Total', format: v => ui.formatCurrency(v) },
                { key: 'paymentStatus', label: 'Payment', format: v => ui.statusBadge(v || 'pending') }
            ];
            c.innerHTML = ui.generateTable(headers, this.receipts, {});
        } catch (err) { document.getElementById('sales-table').innerHTML = ui.errorState(err.message); }
    }
    async showCreate() {
        const inv = await inventoryApi.list({ limit: 100 });
        const items = inv.items || [];
        const content = `
            <form id="sl-form">
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Customer Name</label><input type="text" id="s-cust" placeholder="Walk-in"></div>
                    <div class="form-group"><label>Customer Phone</label><input type="tel" id="s-phone"></div>
                </div>
                <div class="form-group"><label>Store Location *</label><input type="text" id="s-store" required></div>
                <div class="form-group"><label>Item *</label><select id="s-item" required onchange="pageSales.price(this)">
                    <option value="">Select</option>
                    ${items.map(i => `<option value="${i._id}" data-price="${i.sellingPrice}">${i.name} (${i.itemCode}) — ${ui.formatCurrency(i.sellingPrice)}</option>`).join('')}
                </select></div>
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Qty *</label><input type="number" id="s-qty" required min="1" value="1"></div>
                    <div class="form-group"><label>Price *</label><input type="number" id="s-price" required step="0.01"></div>
                </div>
                <div class="form-group"><label>Payment *</label><select id="s-method" required>
                    <option value="cash">Cash</option><option value="card">Card</option><option value="mobile_money">Mobile Money</option><option value="bank_transfer">Bank Transfer</option>
                </select></div>
            </form>`;
        const footer = `<button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button><button class="btn btn-primary" onclick="pageSales.create()">Create</button>`;
        ui.showModal('New Receipt', content, footer);
    }
    price(sel) { document.getElementById('s-price').value = sel.options[sel.selectedIndex].dataset.price || 0; }
    async create() {
        const itemId = document.getElementById('s-item').value;
        if (!itemId) { ui.showToast('warning', 'Validation', 'Select an item'); return; }
        try {
            await receiptsApi.create({
                items: [{ inventoryItem: itemId, quantity: parseFloat(document.getElementById('s-qty').value), unitPrice: parseFloat(document.getElementById('s-price').value) }],
                paymentMethod: document.getElementById('s-method').value,
                storeLocation: document.getElementById('s-store').value,
                customer: { name: document.getElementById('s-cust').value || 'Walk-in Customer', phone: document.getElementById('s-phone').value }
            });
            ui.closeModal(); ui.showToast('success', 'Created', 'Receipt created'); this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
}
const pageSales = new SalesPage();
