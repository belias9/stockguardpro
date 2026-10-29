class ReceiptsPage {
    constructor() { this.receipts = []; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-receipt"></i> Receipts</h3>
                    <button class="btn btn-primary" onclick="pageReceipts.showCreate()">
                        <i class="fas fa-plus"></i> New Receipt
                    </button>
                </div>
                <div class="card-body"><div id="rc-table">${ui.loader()}</div></div>
            </div>
        `;
        await this.load();
    }

    async load() {
        try {
            const res = await receiptsApi.list({ limit: 100 });
            this.receipts = res.receipts || [];
            this.renderTable();
        } catch (err) { document.getElementById('rc-table').innerHTML = ui.errorState(err.message); }
    }

    renderTable() {
        const c = document.getElementById('rc-table');
        if (!this.receipts.length) { c.innerHTML = ui.emptyState('No receipts', 'fa-receipt'); return; }
        const headers = [
            { key: 'receiptId', label: 'ID' },
            { key: 'customer', label: 'Customer', format: v => v?.name || 'Walk-in' },
            { key: 'totalAmount', label: 'Total', format: v => ui.formatCurrency(v) },
            { key: 'paymentStatus', label: 'Payment', format: v => ui.statusBadge(v || 'pending') },
            { key: 'status', label: 'Status', format: v => ui.statusBadge(v) },
            { key: 'createdAt', label: 'Date', format: v => ui.formatDate(v) }
        ];
        const actions = [
            { icon: 'fa-check', title: 'Confirm Payment', class: 'text-success',
              condition: r => r.paymentStatus === 'pending',
              handler: 'pageReceipts.confirmPayment' }
        ];
        c.innerHTML = ui.generateTable(headers, this.receipts, { actions });
    }

    async showCreate() {
        try {
            const inv = await inventoryApi.list({ limit: 200 });
            const items = inv.items || [];
            if (!items.length) {
                ui.showToast('warning', 'No items', 'Add inventory items first');
                return;
            }
            const content = `
                <form id="rc-form">
                    <div class="grid-2 gap-3">
                        <div class="form-group"><label>Customer Name</label><input type="text" id="rc-cust" placeholder="Walk-in Customer"></div>
                        <div class="form-group"><label>Customer Phone</label><input type="tel" id="rc-phone"></div>
                    </div>
                    <div class="form-group"><label>Store Location *</label><input type="text" id="rc-store" required placeholder="Main Store"></div>
                    <div class="form-group"><label>Item *</label>
                        <select id="rc-item" required onchange="pageReceipts.setPrice(this)">
                            <option value="">Select item</option>
                            ${items.map(i => `<option value="${i._id}" data-price="${i.sellingPrice || i.unitCost}">${i.name} (${i.itemCode}) — ${ui.formatCurrency(i.sellingPrice || i.unitCost)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="grid-2 gap-3">
                        <div class="form-group"><label>Qty *</label><input type="number" id="rc-qty" required min="1" value="1"></div>
                        <div class="form-group"><label>Unit Price *</label><input type="number" id="rc-price" required step="0.01"></div>
                    </div>
                    <div class="form-group"><label>Payment Method *</label>
                        <select id="rc-method" required>
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="mobile_money">Mobile Money</option>
                            <option value="bank_transfer">Bank Transfer</option>
                        </select>
                    </div>
                </form>
            `;
            const footer = `
                <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="pageReceipts.doCreate()"><i class="fas fa-receipt"></i> Create</button>
            `;
            ui.showModal('New Receipt', content, footer);
        } catch (err) {
            ui.showToast('error', 'Error', err.message);
        }
    }

    setPrice(sel) {
        const opt = sel.options[sel.selectedIndex];
        document.getElementById('rc-price').value = opt.dataset.price || 0;
    }

    async doCreate() {
        const itemId = document.getElementById('rc-item').value;
        if (!itemId) { ui.showToast('warning', 'Validation', 'Select an item'); return; }
        try {
            await receiptsApi.create({
                items: [{
                    inventoryItem: itemId,
                    quantity: parseFloat(document.getElementById('rc-qty').value),
                    unitPrice: parseFloat(document.getElementById('rc-price').value)
                }],
                paymentMethod: document.getElementById('rc-method').value,
                storeLocation: document.getElementById('rc-store').value,
                customer: {
                    name: document.getElementById('rc-cust').value || 'Walk-in Customer',
                    phone: document.getElementById('rc-phone').value
                }
            });
            ui.closeModal();
            ui.showToast('success', 'Created', 'Receipt created');
            this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    confirmPayment(index) {
        const r = this.receipts[index];
        if (!r) return;
        ui.confirm('Confirm Payment', `Confirm ${ui.formatCurrency(r.totalAmount)} received?`, async () => {
            try {
                await receiptsApi.confirmPayment(r._id, { notes: 'Confirmed' });
                ui.showToast('success', 'Confirmed', 'Payment confirmed');
                this.load();
            } catch (err) { ui.showToast('error', 'Error', err.message); }
        });
    }
}

const pageReceipts = new ReceiptsPage();
