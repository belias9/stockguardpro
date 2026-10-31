class EmployeesBranchView {
    constructor() { this.branches = []; this.currentBranch = null; this.employees = []; }

    async render(container) {
        if (this.currentBranch) return this.renderBranchEmployees(container);
        return this.renderBranches(container);
    }

    async renderBranches(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header"><h3><i class="fas fa-users"></i> Employees by Branch</h3></div>
                <div class="card-body"><div id="branch-list">${ui.loader()}</div></div>
            </div>`;
        await this.loadBranches();
    }

    async loadBranches() {
        try {
            const res = await branchesApi.list();
            this.branches = res.branches || [];
            const c = document.getElementById('branch-list');
            if (!this.branches.length) { c.innerHTML = ui.emptyState('No branches', 'fa-code-branch'); return; }
            c.innerHTML = this.branches.map(b => `
                <div class="p-3 mb-2 rounded flex justify-between items-center" style="background:var(--bg-primary);cursor:pointer;" onclick="pageEmployeesBranch.open('${b._id || b.id}', '${b.name}')">
                    <div>
                        <p class="font-semibold">${b.name} <span class="text-xs text-muted">(${b.code})</span></p>
                        <p class="text-xs text-muted">${b.type} • ${b.address?.city || '-'}</p>
                    </div>
                    <i class="fas fa-chevron-right text-muted"></i>
                </div>`).join('');
        } catch (err) { document.getElementById('branch-list').innerHTML = ui.errorState(err.message); }
    }

    async open(id, name) {
        this.currentBranch = { id, name };
        this.render(document.getElementById('page-content'));
    }

    async renderBranchEmployees(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <button class="btn btn-secondary btn-sm" onclick="pageEmployeesBranch.back()"><i class="fas fa-arrow-left"></i> Back</button>
                    <h3><i class="fas fa-users"></i> ${this.currentBranch.name}</h3>
                </div>
                <div class="card-body">
                <div class="flex justify-between mb-3">
                        <p class="text-sm text-muted">Employees in ${this.currentBranch.name}</p>
                        <button class="btn btn-primary btn-sm" onclick="router.navigate('users')">
                            <i class="fas fa-cog"></i> Manage Roles & Assign
                        </button>
                    </div>
                    <div id="emp-list">${ui.loader()}</div>
                </div>
            </div>`;
        await this.loadEmployees();
    }

    async loadEmployees() {
        try {
            const res = await usersApi.list({ branchId: this.currentBranch.id, limit: 200 });
            this.employees = res.users || [];
            const c = document.getElementById('emp-list');
            if (!this.employees.length) { c.innerHTML = ui.emptyState('No employees', 'fa-users'); return; }
            const headers = [
                { key: 'employeeId', label: 'ID' },
                { key: 'firstName', label: 'First' },
                { key: 'lastName', label: 'Last' },
                { key: 'email', label: 'Email' },
                { key: 'role', label: 'Role' },
                { key: 'activeRoles', label: 'Functions', format: v => (v || []).join(', ') || '-' },
                { key: 'isMainStock', label: 'Main', format: v => v ? '⭐' : '-' }
            ];
            c.innerHTML = ui.generateTable(headers, this.employees, {});
        } catch (err) { document.getElementById('emp-list').innerHTML = ui.errorState(err.message); }
    }

    back() {
        this.currentBranch = null;
        this.render(document.getElementById('page-content'));
    }
}
const pageEmployeesBranch = new EmployeesBranchView();
