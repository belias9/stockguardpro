class InventoryModePage {
    constructor() { this.audits = []; this.warehouses = []; }

    async render(container) {
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header">
                    <h3><i class="fas fa-clipboard-check"></i> Inventory Mode</h3>
                    <button class="btn btn-primary" onclick="pageInventoryMode.showStart()">
                        <i class="fas fa-play"></i> Start Audit
                    </button>
                </div>
                <div class="card-body">
                    <p class="text-sm text-secondary">Blind count: quantities hidden from staff during count. Only employer/manager see actual counts.</p>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Audit History</h3></div>
                <div class="card-body"><div id="audit-table">${ui.loader()}</div></div>
            </div>
        `;
        await Promise.all([this.loadWarehouses(), this.load()]);
    }

    async loadWarehouses() {
        try { this.warehouses = (await warehousesApi.list({})).warehouses || []; }
        catch { this.warehouses = []; }
    }

    async load() {
        try {
            const res = await inventoryModeApi.list({});
            this.audits = res.audits || [];
            this.renderTable();
        } catch (err) { document.getElementById('audit-table').innerHTML = ui.errorState(err.message); }
    }

    renderTable() {
        const c = document.getElementById('audit-table');
        if (!this.audits.length) { c.innerHTML = ui.emptyState('No audits yet', 'fa-clipboard-check'); return; }
        const headers = [
            { key: 'auditId', label: 'ID' },
            { key: 'warehouse', label: 'Warehouse', format: v => v?.name || '-' },
            { key: 'status', label: 'Status', format: v => ui.statusBadge(v === 'in_progress' ? 'pending' : 'completed') },
            { key: 'startedByName', label: 'Started By' },
            { key: 'startedAt', label: 'Started', format: v => ui.formatDate(v) },
            { key: 'summary', label: 'Counted', format: v => v?.totalItems ?? 0 }
        ];
        const actions = [
            { icon: 'fa-eye', title: 'View', class: 'text-primary', handler: 'pageInventoryMode.showDetail' },
            { icon: 'fa-check', title: 'Complete', class: 'text-success', condition: r => r.status === 'in_progress', handler: 'pageInventoryMode.complete' }
        ];
        c.innerHTML = ui.generateTable(headers, this.audits, { actions });
    }

    showStart() {
        if (!this.warehouses.length) { ui.showToast('warning', 'No warehouses', 'Create a warehouse first'); return; }
        const content = `
            <form id="start-audit">
                <div class="form-group">
                    <label>Warehouse *</label>
                    <select id="a-wh" required>
                        ${this.warehouses.filter(w => w.isActive).map(w => `<option value="${w._id}">${w.name} (${w.code})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Notes</label><textarea id="a-notes" rows="2"></textarea></div>
                <div class="p-3 rounded" style="background:var(--warning-light);">
                    <p class="text-sm text-warning"><i class="fas fa-exclamation-triangle"></i> Quantities will be blurred. Staff must physically count items.</p>
                </div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageInventoryMode.doStart()"><i class="fas fa-play"></i> Start</button>
        `;
        ui.showModal('Start Inventory Audit', content, footer);
    }

    async doStart() {
        try {
            await inventoryModeApi.start({
                warehouseId: document.getElementById('a-wh').value,
                notes: document.getElementById('a-notes').value
            });
            ui.closeModal();
            ui.showToast('success', 'Started', 'Inventory mode active');
            this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    showDetail(index) {
        const a = this.audits[index];
        if (!a) return;
        const items = (a.items || []).map(i => `
            <tr>
                <td>${i.itemName}</td>
                <td>${i.systemQuantity}</td>
                <td>${i.actualCount ?? '-'}</td>
                <td>${i.surplusOrLacking !== null && i.surplusOrLacking !== undefined ? (i.surplusOrLacking > 0 ? '+' + i.surplusOrLacking : i.surplusOrLacking) : '-'}</td>
            </tr>
        `).join('');
        const content = `
            <div class="mb-3">
                <p class="text-sm"><strong>Warehouse:</strong> ${a.warehouse?.name || '-'}</p>
                <p class="text-sm"><strong>Status:</strong> ${a.status}</p>
                <p class="text-sm"><strong>Summary:</strong> ${a.summary?.totalItems || 0} counted, ${a.summary?.totalSurplus || 0} surplus, ${a.summary?.totalLacking || 0} lacking</p>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr><th>Item</th><th>System</th><th>Actual</th><th>Diff</th></tr></thead>
                    <tbody>${items || '<tr><td colspan="4" class="text-muted">No items</td></tr>'}</tbody>
                </table>
            </div>
        `;
        ui.showModal(`Audit ${a.auditId}`, content);
    }

    complete(index) {
        const a = this.audits[index];
        ui.confirm('Complete Audit', `Apply actual counts for ${a.auditId}? This will update inventory.`, async () => {
            try {
                await inventoryModeApi.complete(a._id);
                ui.showToast('success', 'Completed', 'Audit closed, stock updated');
                this.load();
            } catch (err) { ui.showToast('error', 'Error', err.message); }
        });
    }
}

const pageInventoryMode = new InventoryModePage();