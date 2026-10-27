class ReceiptsPage {
    constructor() { this.receipts = []; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header"><h3><i class="fas fa-receipt"></i> Receipts</h3></div>
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
            { key: 'customer', label: 'Customer', format: v => v?.name || '-' },
            { key: 'totalAmount', label: 'Total', format: v => ui.formatCurrency(v) },
            { key: 'paymentStatus', label: 'Payment', format: v => ui.statusBadge(v || 'pending') },
            { key: 'status', label: 'Status', format: v => ui.statusBadge(v) },
            { key: 'createdAt', label: 'Date', format: v => ui.formatDate(v) }
        ];
        c.innerHTML = ui.generateTable(headers, this.receipts, {});
    }
}

const pageReceipts = new ReceiptsPage();