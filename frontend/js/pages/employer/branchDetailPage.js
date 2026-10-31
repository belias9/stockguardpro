class BranchDetailPage {
    constructor() {
        this.branches = [];
        this.currentBranch = null;
        this.currentWarehouse = null;
    }

    async render(container) {
        if (this.currentWarehouse) return this.renderWarehouseDetail(container);
        if (this.currentBranch) return this.renderBranchDetail(container);
        return this.renderBranches(container);
    }

    // ============ LEVEL 1: BRANCHES LIST ============
    async renderBranches(container) {
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header">
                    <h3><i class="fas fa-code-branch"></i> Branches</h3>
                    <button class="btn btn-primary" onclick="pageBranchDetail.showAddBranch()">
                        <i class="fas fa-plus"></i> Add Branch
                    </button>
                </div>
                <div class="card-body"><div id="br-list">${ui.loader()}</div></div>
            </div>`;
        await this.loadBranches();
    }

    async loadBranches() {
        try {
            const res = await branchesApi.list();
            this.branches = res.branches || [];
            const c = document.getElementById('br-list');
            if (!this.branches.length) { c.innerHTML = ui.emptyState('No branches', 'fa-code-branch'); return; }
            c.innerHTML = this.branches.map(b => `
                <div class="p-3 mb-2 rounded flex justify-between items-center" style="background:var(--bg-primary);cursor:pointer;" onclick="pageBranchDetail.openBranch('${b._id}')">
                    <div>
                        <p class="font-semibold">${b.name} <span class="text-xs text-muted">(${b.code})</span></p>
                        <p class="text-xs text-muted">${b.type} • ${b.address?.city || ''} • Manager: ${b.manager ? b.manager.firstName + ' ' + b.manager.lastName : 'Not assigned'}</p>
                    </div>
                    <i class="fas fa-chevron-right text-muted"></i>
                </div>`).join('');
        } catch (err) { document.getElementById('br-list').innerHTML = ui.errorState(err.message); }
    }

    async openBranch(id) {
        const b = this.branches.find(x => x._id === id);
        if (!b) return;
        this.currentBranch = b;
        this.render(document.getElementById('page-content'));
    }

    // ============ LEVEL 2: BRANCH DETAIL ============
    async renderBranchDetail(container) {
        const b = this.currentBranch;
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header">
                    <button class="btn btn-secondary btn-sm" onclick="pageBranchDetail.backToBranches()">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                    <h3><i class="fas fa-building"></i> ${b.name}</h3>
                    <button class="btn btn-primary" onclick="pageBranchDetail.showAddWarehouse()">
                        <i class="fas fa-plus"></i> Add Warehouse
                    </button>
                </div>
                <div class="card-body">
                    <p class="text-sm mb-3"><strong>Type:</strong> ${b.type} • <strong>City:</strong> ${b.address?.city || '-'} • <strong>Manager:</strong> ${b.manager ? b.manager.firstName + ' ' + b.manager.lastName : 'Not assigned'}</p>
                    <h4 class="mb-2">Warehouses</h4>
                    <div id="wh-list">${ui.loader()}</div>
                </div>
            </div>`;
        await this.loadWarehouses();
    }

    async loadWarehouses() {
        try {
            const res = await warehousesApi.list({ branchId: this.currentBranch._id });
            const list = res.warehouses || [];
            const c = document.getElementById('wh-list');
            if (!list.length) { c.innerHTML = ui.emptyState('No warehouses', 'fa-warehouse'); return; }
            c.innerHTML = list.map(w => `
                <div class="p-3 mb-2 rounded flex justify-between items-center" style="background:var(--bg-primary);cursor:pointer;" onclick="pageBranchDetail.openWarehouse('${w._id}')">
                    <div>
                        <p class="font-semibold">${w.name} <span class="text-xs text-muted">(${w.code})</span></p>
                        <p class="text-xs text-muted">Manager: ${w.manager ? w.manager.firstName + ' ' + w.manager.lastName : 'Not assigned'} • ${w.isDefault ? '⭐ Default' : ''}</p>
                    </div>
                    <i class="fas fa-chevron-right text-muted"></i>
                </div>`).join('');
        } catch (err) { document.getElementById('wh-list').innerHTML = ui.errorState(err.message); }
    }

    async openWarehouse(id) {
        try {
            const res = await warehousesApi.list({ branchId: this.currentBranch._id });
            const w = (res.warehouses || []).find(x => x._id === id);
            if (!w) return;
            this.currentWarehouse = w;
            this.render(document.getElementById('page-content'));
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    backToBranches() {
        this.currentBranch = null;
        this.currentWarehouse = null;
        this.render(document.getElementById('page-content'));
    }

    backToBranch() {
        this.currentWarehouse = null;
        this.render(document.getElementById('page-content'));
    }

    // ============ LEVEL 3: WAREHOUSE DETAIL ============
    async renderWarehouseDetail(container) {
        const w = this.currentWarehouse;
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header">
                    <button class="btn btn-secondary btn-sm" onclick="pageBranchDetail.backToBranch()">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                    <h3><i class="fas fa-warehouse"></i> ${w.name}</h3>
                </div>
                <div class="card-body">
                    <p class="text-sm mb-3"><strong>Code:</strong> ${w.code} • <strong>Manager:</strong> ${w.manager ? w.manager.firstName + ' ' + w.manager.lastName : 'Not assigned'}</p>
                    <h4 class="mb-2">Inventory</h4>
                    <div id="wh-inventory">${ui.loader()}</div>
                </div>
            </div>`;
        await this.loadInventory();
    }

    async loadInventory() {
        try {
            const res = await inventoryApi.list({ warehouseId: this.currentWarehouse._id, limit: 500 });
            const items = res.items || [];
            const c = document.getElementById('wh-inventory');
            if (!items.length) { c.innerHTML = ui.emptyState('No items', 'fa-box-open'); return; }
            const headers = [
                { key: 'itemCode', label: 'Code' },
                { key: 'name', label: 'Name' },
                { key: 'quantity', label: 'Qty', format: (v, r) => `${v} ${r.unit}` },
                { key: 'sellingPrice', label: 'Price', format: v => ui.formatCurrency(v) }
            ];
            c.innerHTML = ui.generateTable(headers, items, {});
        } catch (err) { document.getElementById('wh-inventory').innerHTML = ui.errorState(err.message); }
    }

    // ============ ADD BRANCH ============
    showAddBranch() {
        const content = `
            <form id="add-br">
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Name *</label><input type="text" id="b-name" required></div>
                    <div class="form-group"><label>Code *</label><input type="text" id="b-code" required></div>
                </div>
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Type *</label><select id="b-type" required>
                        <option value="store">Store</option><option value="warehouse">Warehouse</option>
                        <option value="office">Office</option><option value="mixed">Mixed</option>
                    </select></div>
                    <div class="form-group"><label>City *</label><input type="text" id="b-city" required></div>
                </div>
            </form>`;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageBranchDetail.addBranch()">Add</button>`;
        ui.showModal('Add Branch', content, footer);
    }

    async addBranch() {
        try {
            await branchesApi.create({
                name: document.getElementById('b-name').value,
                code: document.getElementById('b-code').value.toUpperCase(),
                type: document.getElementById('b-type').value,
                address: { city: document.getElementById('b-city').value }
            });
            ui.closeModal(); ui.showToast('success', 'Created', 'Branch created');
            this.loadBranches();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    // ============ ADD WAREHOUSE ============
    showAddWarehouse() {
        const content = `
            <form id="add-wh">
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Name *</label><input type="text" id="w-name" required></div>
                    <div class="form-group"><label>Code *</label><input type="text" id="w-code" required></div>
                </div>
                <div class="form-group"><label><input type="checkbox" id="w-default"> Default warehouse</label></div>
            </form>`;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageBranchDetail.addWarehouse()">Add</button>`;
        ui.showModal('Add Warehouse', content, footer);
    }

    async addWarehouse() {
        try {
            await warehousesApi.create({
                name: document.getElementById('w-name').value,
                code: document.getElementById('w-code').value.toUpperCase(),
                branchId: this.currentBranch._id,
                isDefault: document.getElementById('w-default').checked
            });
            ui.closeModal(); ui.showToast('success', 'Created', 'Warehouse created');
            this.loadWarehouses();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
}
const pageBranchDetail = new BranchDetailPage();
