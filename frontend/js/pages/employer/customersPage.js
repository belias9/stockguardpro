class CustomersPage {
    constructor() { this.customers = []; this.current = null; this.receipts = []; this.receiptThreshold = 50000; }

    async render(container) {
        if (this.current) return this.renderDetail(container);
        return this.renderList(container);
    }

    async renderList(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-user-friends"></i> Customers</h3>
                    <div class="search-bar" style="max-width:300px;"><i class="fas fa-search"></i>
                        <input type="search" placeholder="Search name or phone..." oninput="pageCustomers.search(this.value)">
                    </div>
                </div>
                <div class="card-body"><div id="cust-list">${ui.loader()}</div></div>
            </div>`;
        await this.load();
    }

    async load() {
        try {
            const res = await customersApi.list({ limit: 200 });
            this.customers = res.customers || [];
            const c = document.getElementById('cust-list');
            if (!this.customers.length) { c.innerHTML = ui.emptyState('No customers', 'fa-user-friends'); return; }
            c.innerHTML = this.customers.map((cu, i) => `
                <div class="p-3 mb-2 rounded flex justify-between items-center" style="background:var(--bg-primary);cursor:pointer;" onclick="pageCustomers.open(${i})">
                    <div>
                        <p class="font-semibold">${cu.name}</p>
                        <p class="text-xs text-muted">${cu.phone} • ${cu.totalOrders || 0} orders</p>
                    </div>
                    <i class="fas fa-chevron-right text-muted"></i>
                </div>`).join('');
        } catch (err) { document.getElementById('cust-list').innerHTML = ui.errorState(err.message); }
    }

    search(q) {
        clearTimeout(this._t);
        this._t = setTimeout(async () => {
            try { const res = await customersApi.list({ search: q, limit: 200 }); this.customers = res.customers || []; this.load(); } catch {}
        }, 300);
    }

    async open(i) {
        this.current = this.customers[i];
        try {
            try { const p = await api.get('/company/profile'); this.receiptThreshold = Number(p.company?.settings?.receiptWhatsAppThreshold ?? 50000); } catch {}
            const res = await receiptsApi.list({ limit: 200 });
            const all = res.receipts || [];
            this.receipts = all.filter(r => r.customer?.phone === this.current.phone || r.customer?.name === this.current.name);
            this.fullReceipts = all;
            this.render(document.getElementById('page-content'));
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async renderDetail(container) {
        const c = this.current;
        const minThreshold = this.receiptThreshold;
        const aboveThreshold = this.receipts.filter(r => (r.totalAmount || 0) >= minThreshold);
        const belowThreshold = this.receipts.filter(r => (r.totalAmount || 0) < minThreshold);

        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header">
                    <button class="btn btn-secondary btn-sm" onclick="pageCustomers.back()"><i class="fas fa-arrow-left"></i> Back</button>
                    <h3><i class="fas fa-user"></i> ${c.name}</h3>
                </div>
                <div class="card-body">
                    <div class="grid-2 gap-3">
                        <div><p class="text-sm text-secondary">Phone</p><p class="font-semibold">${c.phone}</p></div>
                        <div><p class="text-sm text-secondary">Email</p><p class="font-semibold">${c.email || '-'}</p></div>
                        <div><p class="text-sm text-secondary">Total Orders</p><p class="font-semibold">${c.totalOrders || 0}</p></div>
                        <div><p class="text-sm text-secondary">Total Spent</p><p class="font-semibold">${ui.formatCurrency(c.totalSpent || 0)}</p></div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-header"><h4><i class="fas fa-receipt"></i> Full History (${aboveThreshold.length})</h4></div>
                <div class="card-body">
                    ${aboveThreshold.length ? `
                        <div class="table-container"><table>
                            <thead><tr><th>Receipt</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
                            <tbody>${aboveThreshold.map(r => `<tr><td><button class="btn btn-text text-primary" onclick="pageCustomers.showReceipt('${r._id||r.id}')">${r.receiptId}</button></td><td>${ui.formatDate(r.createdAt)}</td><td>${ui.formatCurrency(r.totalAmount)}</td><td>${ui.statusBadge(r.paymentStatus || 'pending')}</td></tr>`).join('')}</tbody>
                        </table></div>
                    ` : `<p class="text-muted text-sm">No receipts above ${ui.formatCurrency(minThreshold)} yet</p>`}
                </div>
            </div>

            <div class="card">
                <div class="card-header"><h4><i class="fas fa-lock"></i> Restricted (${belowThreshold.length})</h4></div>
                <div class="card-body">
                    <p class="text-xs text-muted mb-2">Only receipts above ${ui.formatCurrency(minThreshold)} are shown in full. Lower-value receipts listed without details.</p>
                    ${belowThreshold.map(r => `<div class="p-2 mb-1 rounded text-sm" style="background:var(--bg-primary);">
                        <span class="text-muted">${ui.formatDate(r.createdAt)} — ${ui.formatCurrency(r.totalAmount)}</span>
                    </div>`).join('') || '<p class="text-muted text-sm">No low-value receipts</p>'}
                </div>
            </div>`;
    }

    back() {
        this.current = null;
        this.render(document.getElementById('page-content'));
    }
    showReceipt(id) {
        const r=(this.receipts||[]).find(x=>(x._id||x.id)===id);if(!r)return;
        const rows=(r.items||[]).map(it=>`<tr><td>${it.itemName||it.itemCode}</td><td>${it.quantity} ${it.unit||''}</td><td>${ui.formatCurrency(it.unitPrice)}</td><td>${ui.formatCurrency(it.totalPrice)}</td></tr>`).join('');
        ui.showModal(`Receipt ${r.receiptId}`,`<p><strong>Customer:</strong> ${r.customer?.name||'Walk-in'} · ${r.customer?.phone||''}</p><p><strong>Date:</strong> ${ui.formatDate(r.createdAt,'long')} · <strong>Payment:</strong> ${r.paymentStatus}</p><div class="table-container"><table><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div><p class="text-right font-bold mt-2">Total: ${ui.formatCurrency(r.totalAmount)}</p>`);
    }
}
const pageCustomers = new CustomersPage();
