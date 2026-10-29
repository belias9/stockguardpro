class InventoryPage {
    constructor() { this.items = []; this.warehouses = []; this.branches = []; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-boxes"></i> Inventory</h3>
                    <button class="btn btn-primary" onclick="pageInventory.showCreate()"><i class="fas fa-plus"></i> Add Item</button>
                </div>
                <div class="card-body">
                    <div class="flex gap-2 mb-3">
                        <div class="search-bar flex-1">
                            <i class="fas fa-search"></i>
                            <input type="search" placeholder="Search items..." oninput="pageInventory.search(this.value)">
                        </div>
                    </div>
                    <div id="inv-table">${ui.loader()}</div>
                </div>
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
            const res = await inventoryApi.list({ limit: 100 });
            this.items = res.items || [];
            this.renderTable();
        } catch (err) { document.getElementById('inv-table').innerHTML = ui.errorState(err.message); }
    }

    search(q) {
        clearTimeout(this._t);
        this._t = setTimeout(async () => {
            try {
                const res = await inventoryApi.list({ search: q, limit: 100 });
                this.items = res.items || [];
                this.renderTable();
            } catch {}
        }, 300);
    }

    renderTable() {
        const c = document.getElementById('inv-table');
        if (!this.items.length) { c.innerHTML = ui.emptyState('No items', 'fa-box-open'); return; }
        const headers = [
            { key: 'itemCode', label: 'Code' },
            { key: 'name', label: 'Name' },
            { key: 'category', label: 'Category' },
            { key: 'quantity', label: 'Qty', format: (v, r) => `${v} ${r.unit}` },
            { key: 'sellingPrice', label: 'Price', format: v => ui.formatCurrency(v) },
            { key: 'warehouse', label: 'Warehouse', format: v => v?.name || '-' }
        ];
        const actions = [
            { icon: 'fa-edit', title: 'Edit', class: 'text-primary', handler: 'pageInventory.showEdit' },
            { icon: 'fa-sliders-h', title: 'Adjust', class: 'text-warning', handler: 'pageInventory.showAdjust' }
        ];
        c.innerHTML = ui.generateTable(headers, this.items, { actions });
    }

    showCreate() {
        if (!this.warehouses.length) { ui.showToast('warning', 'No warehouses', 'Create a warehouse first'); return; }
        const content = `
            <form id="inv-form">
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Code *</label><input type="text" id="i-code" required></div>
                    <div class="form-group"><label>Name *</label><input type="text" id="i-name" required></div>
                </div>
                <div class="form-group">
                    <label>Warehouse *</label>
                    <select id="i-wh" required>
                        ${this.warehouses.map(w => `<option value="${w._id}">${w.name}</option>`).join('')}
                    </select>
                </div>
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Category *</label><input type="text" id="i-cat" required placeholder="electronics"></div>
                    <div class="form-group"><label>Unit *</label><input type="text" id="i-unit" required placeholder="pieces"></div>
                </div>
                <div class="grid-3 gap-3">
                    <div class="form-group"><label>Qty *</label><input type="number" id="i-qty" required min="0"></div>
                    <div class="form-group"><label>Unit Cost *</label><input type="number" id="i-cost" required min="0" step="0.01"></div>
                    <div class="form-group"><label>Selling Price</label><input type="number" id="i-price" min="0" step="0.01"></div>
                </div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageInventory.save()"><i class="fas fa-save"></i> Create</button>
        `;
        ui.showModal('New Inventory Item', content, footer);
        this.editingId = null;
    }

    showEdit(index) {
        const it = this.items[index];
        if (!it) return;
        this.editingId = it._id;
        const content = `
            <form id="inv-form">
                <div class="form-group"><label>Name</label><input type="text" id="i-name" value="${it.name}"></div>
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Unit Cost</label><input type="number" id="i-cost" value="${it.unitCost}" step="0.01"></div>
                    <div class="form-group"><label>Selling Price</label><input type="number" id="i-price" value="${it.sellingPrice}" step="0.01"></div>
                </div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageInventory.update()"><i class="fas fa-save"></i> Save</button>
        `;
        ui.showModal('Edit Item', content, footer);
    }

    async save() {
        const data = {
            warehouseId: document.getElementById('i-wh').value,
            itemCode: document.getElementById('i-code').value.toUpperCase(),
            name: document.getElementById('i-name').value,
            category: document.getElementById('i-cat').value.toLowerCase(),
            unit: document.getElementById('i-unit').value.toLowerCase(),
            quantity: parseFloat(document.getElementById('i-qty').value) || 0,
            unitCost: parseFloat(document.getElementById('i-cost').value) || 0,
            sellingPrice: parseFloat(document.getElementById('i-price').value) || 0
        };
        try {
            await inventoryApi.create(data);
            ui.closeModal();
            ui.showToast('success', 'Created', 'Item created');
            this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async update() {
        const assignedRoles = Array.from(document.querySelectorAll('.assign-role:checked')).map(c => c.value);
        const activeRoles = Array.from(document.querySelectorAll('.active-role:checked')).map(c => c.value);

        const data = {
            firstName: document.getElementById('u-first').value,
            lastName: document.getElementById('u-last').value,
            phone: document.getElementById('u-phone').value,
            baseSalary: parseFloat(document.getElementById('u-salary').value) || 0,
            isMainStock: document.getElementById('u-main-stock').checked,
            roles: assignedRoles.length ? assignedRoles : ['none'],
            activeRoles: activeRoles
        };

        try {
            await usersApi.update(this.editingId, data);
            ui.closeModal();
            ui.showToast('success', 'Updated', 'User updated');
            this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
    showAdjust(index) {
        const it = this.items[index];
        if (!it) return;
        const content = `
            <form id="adj-form">
                <p class="mb-3">Item: <strong>${it.name}</strong> | Current: <strong>${it.quantity} ${it.unit}</strong></p>
                <div class="form-group"><label>Adjustment (+/-) *</label><input type="number" id="a-qty" required step="0.01" placeholder="Positive to add, negative to remove"></div>
                <div class="form-group"><label>Reason *</label><textarea id="a-reason" required></textarea></div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-warning" onclick="pageInventory.doAdjust('${it._id}')"><i class="fas fa-sliders-h"></i> Adjust</button>
        `;
        ui.showModal('Adjust Stock', content, footer);
    }

    async doAdjust(id) {
        try {
            await inventoryApi.adjust(id, {
                adjustment: parseFloat(document.getElementById('a-qty').value),
                reason: document.getElementById('a-reason').value
            });
            ui.closeModal();
            ui.showToast('success', 'Adjusted', 'Stock adjusted');
            this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
}

const pageInventory = new InventoryPage();