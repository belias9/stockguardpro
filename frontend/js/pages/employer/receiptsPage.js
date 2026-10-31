class ReceiptsPage {
    constructor() { this.receipts = []; this.items = []; this.rows = []; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-receipt"></i> Receipts</h3>
                    <button class="btn btn-primary" onclick="pageReceipts.showCreate()"><i class="fas fa-plus"></i> New Receipt</button>
                </div>
                <div class="card-body"><div id="rc-table">${ui.loader()}</div></div>
            </div>`;
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
            { key: 'createdAt', label: 'Date', format: v => ui.formatDate(v) }
        ];
        const actions = [
            { icon: 'fa-print', title: 'Print', class: 'text-primary', handler: 'pageReceipts.print' },
            { icon: 'fa-whatsapp', title: 'WhatsApp', class: 'text-success', handler: 'pageReceipts.sendWA' },
            { icon: 'fa-check', title: 'Confirm Payment', class: 'text-info',
              condition: r => r.paymentStatus === 'pending',
              handler: 'pageReceipts.confirmPay' }
        ];
        c.innerHTML = ui.generateTable(headers, this.receipts, { actions });
    }

    async showCreate() {
        try {
            const inv = await inventoryApi.list({ limit: 500 });
            this.items = inv.items || [];
            if (!this.items.length) { ui.showToast('warning', 'No items', 'Add inventory first'); return; }
            this.rows = [{ itemId: '', qty: 1, price: 0 }];
            this.renderCreateModal();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    renderCreateModal() {
        const rowsHtml = this.rows.map((r, i) => `
            <div class="rc-row grid-4 gap-2 mb-2">
                <div class="form-group"><label>Item</label>
                    <select onchange="pageReceipts.setItem(${i}, this)" required>
                        <option value="">Select</option>
                        ${this.items.map(it => `<option value="${it._id}" data-price="${it.sellingPrice || it.unitCost}" ${r.itemId === it._id ? 'selected' : ''}>${it.name} (${it.itemCode})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Qty</label><input type="number" value="${r.qty}" min="1" onchange="pageReceipts.setQty(${i}, this)"></div>
                <div class="form-group"><label>Price</label><input type="number" value="${r.price}" step="0.01" onchange="pageReceipts.setP(${i}, this)"></div>
                <div class="form-group"><label>&nbsp;</label><button type="button" class="btn btn-danger btn-sm" onclick="pageReceipts.removeRow(${i})"><i class="fas fa-trash"></i></button></div>
            </div>`).join('');

        const content = `
            <form id="rc-form">
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Customer Name</label><input type="text" id="rc-cust" placeholder="Walk-in"></div>
                    <div class="form-group"><label>Customer Phone</label><input type="tel" id="rc-phone" placeholder="+237..."></div>
                </div>
                <div class="form-group"><label>Store Location *</label><input type="text" id="rc-store" required placeholder="Main Store"></div>
                <h4 class="mb-2">Items</h4>
                <div id="rc-rows">${rowsHtml}</div>
                <button type="button" class="btn btn-secondary btn-sm mb-3" onclick="pageReceipts.addRow()">+ Add Item</button>
                <div class="form-group"><label>Payment Method *</label>
                    <select id="rc-method" required>
                        <option value="cash">Cash</option><option value="card">Card</option>
                        <option value="mobile_money">Mobile Money</option><option value="bank_transfer">Bank Transfer</option>
                    </select>
                </div>
                <p class="text-lg"><strong>Total:</strong> <span id="rc-total" class="text-primary">${ui.formatCurrency(this.total())}</span></p>
            </form>`;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageReceipts.doCreate()"><i class="fas fa-receipt"></i> Create Receipt</button>`;
        ui.showModal('New Receipt', content, footer);
    }

    total() { return this.rows.reduce((s, r) => s + (r.qty * r.price), 0); }
    addRow() { this.rows.push({ itemId: '', qty: 1, price: 0 }); this.renderCreateModal(); }
    removeRow(i) { this.rows.splice(i, 1); if (!this.rows.length) this.rows.push({ itemId: '', qty: 1, price: 0 }); this.renderCreateModal(); }
    setItem(i, sel) { const o = sel.options[sel.selectedIndex]; this.rows[i].itemId = sel.value; this.rows[i].price = parseFloat(o.dataset.price) || 0; this.renderCreateModal(); }
    setQty(i, inp) { this.rows[i].qty = parseFloat(inp.value) || 1; document.getElementById('rc-total').textContent = ui.formatCurrency(this.total()); }
    setP(i, inp) { this.rows[i].price = parseFloat(inp.value) || 0; document.getElementById('rc-total').textContent = ui.formatCurrency(this.total()); }

    async doCreate() {
        const store = document.getElementById('rc-store')?.value?.trim();
        if (!store) { ui.showToast('warning', 'Validation', 'Store location required'); return; }
        const items = this.rows.filter(r => r.itemId && r.qty > 0).map(r => ({ inventoryItem: r.itemId, quantity: r.qty, unitPrice: r.price }));
        if (!items.length) { ui.showToast('warning', 'Validation', 'Add at least one item'); return; }
        try {
            await receiptsApi.create({
                items,
                paymentMethod: document.getElementById('rc-method').value,
                storeLocation: store,
                customer: { name: document.getElementById('rc-cust').value || 'Walk-in Customer', phone: document.getElementById('rc-phone').value }
            });
            ui.closeModal(); ui.showToast('success', 'Created', 'Receipt created'); this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async print(index) {
        const r = this.receipts[index];
        if (!r) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/receipts/${r.id || r._id}/print`, {
                headers: auth.getAuthHeaders()
            });
            const html = await res.text();
            const w = window.open('', '_blank');
            w.document.write(html);
            w.document.close();
        } catch (err) { ui.showToast('error', 'Print failed', err.message); }
    }

    async sendWA(index) {
        const r = this.receipts[index];
        if (!r) return;
        try {
            const res = await receiptsApi.sendWhatsApp(r.id || r._id);
            ui.showToast(res.success ? 'success' : 'warning', 'WhatsApp', res.message || 'Sent');
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    confirmPay(index) {
        const r = this.receipts[index];
        ui.confirm('Confirm Payment', `Confirm ${ui.formatCurrency(r.totalAmount)}?`, async () => {
            try { await receiptsApi.confirmPayment(r.id || r._id, { notes: 'Confirmed' }); ui.showToast('success', 'Confirmed', 'Payment confirmed'); this.load(); }
            catch (err) { ui.showToast('error', 'Error', err.message); }
        });
    }
}
const pageReceipts = new ReceiptsPage();
