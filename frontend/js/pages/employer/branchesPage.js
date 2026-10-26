class BranchesPage {
    constructor() { this.branches = []; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-code-branch"></i> Branches</h3>
                    <button class="btn btn-primary" onclick="pageBranches.showCreate()">
                        <i class="fas fa-plus"></i> New Branch
                    </button>
                </div>
                <div class="card-body"><div id="branches-table">${ui.loader()}</div></div>
            </div>
        `;
        await this.load();
    }

    async load() {
        try {
            const res = await branchesApi.list();
            this.branches = res.branches || [];
            this.renderTable();
        } catch (err) {
            document.getElementById('branches-table').innerHTML = ui.errorState(err.message);
        }
    }

    renderTable() {
        const c = document.getElementById('branches-table');
        if (!this.branches.length) {
            c.innerHTML = ui.emptyState('No branches yet', 'fa-code-branch');
            return;
        }
        const headers = [
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code' },
            { key: 'type', label: 'Type', format: v => v.charAt(0).toUpperCase() + v.slice(1) },
            { key: 'address.city', label: 'City', format: (v, r) => r.address?.city || '-' },
            { key: 'isActive', label: 'Status', format: v => v ? '<span class="status-badge completed">Active</span>' : '<span class="status-badge rejected">Inactive</span>' }
        ];
        const actions = [
            { icon: 'fa-edit', title: 'Edit', class: 'text-primary', handler: 'pageBranches.showEdit' },
            { icon: 'fa-trash', title: 'Deactivate', class: 'text-danger', condition: r => r.isActive, handler: 'pageBranches.confirmDeactivate' }
        ];
        c.innerHTML = ui.generateTable(headers, this.branches, { actions });
    }

    showCreate() {
        const content = `
            <form id="branch-form">
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Name *</label><input type="text" id="br-name" required></div>
                    <div class="form-group"><label>Code *</label><input type="text" id="br-code" required placeholder="e.g. MAIN"></div>
                </div>
                <div class="grid-2 gap-3">
                    <div class="form-group">
                        <label>Type *</label>
                        <select id="br-type" required>
                            <option value="store">Store</option>
                            <option value="warehouse">Warehouse</option>
                            <option value="office">Office</option>
                            <option value="mixed">Store + Warehouse</option>
                        </select>
                    </div>
                    <div class="form-group"><label>City *</label><input type="text" id="br-city" required></div>
                </div>
                <div class="form-group"><label>Street</label><input type="text" id="br-street"></div>
                <div class="form-group"><label>Phone</label><input type="tel" id="br-phone"></div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageBranches.save()"><i class="fas fa-save"></i> Create</button>
        `;
        ui.showModal('New Branch', content, footer);
        this.editingId = null;
    }

    showEdit(index) {
        const b = this.branches[index];
        if (!b) return;
        this.editingId = b._id;
        const content = `
            <form id="branch-form">
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Name *</label><input type="text" id="br-name" value="${b.name}" required></div>
                    <div class="form-group"><label>Code *</label><input type="text" id="br-code" value="${b.code}" required></div>
                </div>
                <div class="grid-2 gap-3">
                    <div class="form-group">
                        <label>Type *</label>
                        <select id="br-type" required>
                            ${['store','warehouse','office','mixed'].map(t => `<option value="${t}" ${b.type === t ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group"><label>City *</label><input type="text" id="br-city" value="${b.address?.city || ''}" required></div>
                </div>
                <div class="form-group"><label>Street</label><input type="text" id="br-street" value="${b.address?.street || ''}"></div>
                <div class="form-group"><label>Phone</label><input type="tel" id="br-phone" value="${b.phone || ''}"></div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageBranches.save()"><i class="fas fa-save"></i> Save</button>
        `;
        ui.showModal('Edit Branch', content, footer);
    }

    async save() {
        const data = {
            name: document.getElementById('br-name').value,
            code: document.getElementById('br-code').value.toUpperCase(),
            type: document.getElementById('br-type').value,
            address: {
                city: document.getElementById('br-city').value,
                street: document.getElementById('br-street').value
            },
            phone: document.getElementById('br-phone').value
        };
        try {
            if (this.editingId) {
                await branchesApi.update(this.editingId, data);
                ui.showToast('success', 'Updated', 'Branch saved');
            } else {
                await branchesApi.create(data);
                ui.showToast('success', 'Created', 'Branch created');
            }
            ui.closeModal();
            this.load();
        } catch (err) {
            ui.showToast('error', 'Error', err.message);
        }
    }

    confirmDeactivate(index) {
        const b = this.branches[index];
        if (!b) return;
        ui.confirm('Deactivate Branch', `Deactivate "${b.name}"?`, async () => {
            try {
                await branchesApi.deactivate(b._id);
                ui.showToast('success', 'Deactivated', 'Branch deactivated');
                this.load();
            } catch (err) {
                ui.showToast('error', 'Error', err.message);
            }
        });
    }
}

const pageBranches = new BranchesPage();