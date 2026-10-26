class WarehousesPage {
    constructor() { this.warehouses = []; this.branches = []; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-warehouse"></i> Warehouses</h3>
                    <button class="btn btn-primary" onclick="pageWarehouses.showCreate()">
                        <i class="fas fa-plus"></i> New Warehouse
                    </button>
                </div>
                <div class="card-body"><div id="wh-table">${ui.loader()}</div></div>
            </div>
        `;
        await Promise.all([this.loadBranches(), this.load()]);
    }

    async loadBranches() {
        try {
            const res = await branchesApi.list();
            this.branches = res.branches?.filter(b => b.isActive) || [];
        } catch { this.branches = []; }
    }

    async load() {
        try {
            const res = await warehousesApi.list({});
            this.warehouses = res.warehouses || [];
            this.renderTable();
        } catch (err) {
            document.getElementById('wh-table').innerHTML = ui.errorState(err.message);
        }
    }

    renderTable() {
        const c = document.getElementById('wh-table');
        if (!this.warehouses.length) { c.innerHTML = ui.emptyState('No warehouses', 'fa-warehouse'); return; }
        const headers = [
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code' },
            { key: 'branch', label: 'Branch', format: v => v?.name || '-' },
            { key: 'isDefault', label: 'Default', format: v => v ? '<span class="status-badge completed">Yes</span>' : '-' },
            { key: 'isActive', label: 'Status', format: v => v ? '<span class="status-badge completed">Active</span>' : '<span class="status-badge rejected">Inactive</span>' }
        ];
        const actions = [
            { icon: 'fa-edit', title: 'Edit', class: 'text-primary', handler: 'pageWarehouses.showEdit' },
            { icon: 'fa-trash', title: 'Deactivate', class: 'text-danger', condition: r => r.isActive, handler: 'pageWarehouses.confirmDeactivate' }
        ];
        c.innerHTML = ui.generateTable(headers, this.warehouses, { actions });
    }

    showCreate() {
        if (!this.branches.length) {
            ui.showToast('warning', 'No branches', 'Create a branch first');
            return;
        }
        const content = `
            <form id="wh-form">
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Name *</label><input type="text" id="wh-name" required></div>
                    <div class="form-group"><label>Code *</label><input type="text" id="wh-code" required></div>
                </div>
                <div class="form-group">
                    <label>Branch *</label>
                    <select id="wh-branch" required>
                        ${this.branches.map(b => `<option value="${b._id}">${b.name} (${b.code})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>City</label><input type="text" id="wh-city"></div>
                <div class="form-group">
                    <label><input type="checkbox" id="wh-default"> Set as default warehouse for this branch</label>
                </div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageWarehouses.save()"><i class="fas fa-save"></i> Create</button>
        `;
        ui.showModal('New Warehouse', content, footer);
        this.editingId = null;
    }

    showEdit(index) {
        const w = this.warehouses[index];
        if (!w) return;
        this.editingId = w._id;
        const content = `
            <form id="wh-form">
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Name *</label><input type="text" id="wh-name" value="${w.name}" required></div>
                    <div class="form-group"><label>Code *</label><input type="text" id="wh-code" value="${w.code}" required></div>
                </div>
                <div class="form-group">
                    <label>Branch</label>
                    <input type="text" value="${w.branch?.name || '-'}" readonly>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="wh-default" ${w.isDefault ? 'checked' : ''}> Default warehouse</label>
                </div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageWarehouses.save()"><i class="fas fa-save"></i> Save</button>
        `;
        ui.showModal('Edit Warehouse', content, footer);
    }

    async save() {
        const data = {
            name: document.getElementById('wh-name').value,
            code: document.getElementById('wh-code').value.toUpperCase(),
            isDefault: document.getElementById('wh-default').checked
        };
        if (!this.editingId) {
            data.branchId = document.getElementById('wh-branch').value;
            data.address = { city: document.getElementById('wh-city').value };
        }
        try {
            if (this.editingId) await warehousesApi.update(this.editingId, data);
            else await warehousesApi.create(data);
            ui.closeModal();
            ui.showToast('success', 'Saved', 'Warehouse saved');
            this.load();
        } catch (err) {
            ui.showToast('error', 'Error', err.message);
        }
    }

    confirmDeactivate(index) {
        const w = this.warehouses[index];
        if (!w) return;
        ui.confirm('Deactivate Warehouse', `Deactivate "${w.name}"?`, async () => {
            try {
                await warehousesApi.deactivate(w._id);
                ui.showToast('success', 'Deactivated', 'Warehouse deactivated');
                this.load();
            } catch (err) {
                ui.showToast('error', 'Error', err.message);
            }
        });
    }
}

const pageWarehouses = new WarehousesPage();