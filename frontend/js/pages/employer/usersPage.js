class UsersPage {
    constructor() { this.users = []; this.branches = []; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-users"></i> Users & Roles</h3>
                    <button class="btn btn-primary" onclick="pageUsers.showCreate()">
                        <i class="fas fa-user-plus"></i> New User
                    </button>
                </div>
                <div class="card-body"><div id="users-table">${ui.loader()}</div></div>
            </div>
        `;
        await Promise.all([this.loadBranches(), this.load()]);
    }

    async loadBranches() {
        try { this.branches = (await branchesApi.list()).branches?.filter(b => b.isActive) || []; }
        catch { this.branches = []; }
    }

    async load() {
        try {
            const res = await usersApi.list({ limit: 100 });
            this.users = res.users || [];
            this.renderTable();
        } catch (err) {
            document.getElementById('users-table').innerHTML = ui.errorState(err.message);
        }
    }

    renderTable() {
        const c = document.getElementById('users-table');
        if (!this.users.length) { c.innerHTML = ui.emptyState('No users yet', 'fa-users'); return; }
       const headers = [
            { key: 'employeeId', label: 'ID', format: v => v || '-' },
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role' },
            { key: 'activeRoles', label: 'Functions', format: v => (v || []).join(', ') || '-' },
            { key: 'isMainStock', label: 'Main Stock', format: v => v ? '<span class="status-badge completed">⭐ Main</span>' : '-' },
            { key: 'branch', label: 'Branch', format: v => v?.name || '-' },
            { key: 'isActive', label: 'Status', format: v => v ? '<span class="status-badge completed">Active</span>' : '<span class="status-badge rejected">Inactive</span>' }
        ];
        const actions = [
            { icon: 'fa-edit', title: 'Edit', class: 'text-primary', handler: 'pageUsers.showEdit' },
            { icon: 'fa-lock', title: 'Close Account', class: 'text-warning', condition: r => r.isActive && r.role === 'employee', handler: 'pageUsers.showClose' },
            { icon: 'fa-trash', title: 'Deactivate', class: 'text-danger', condition: r => r.isActive, handler: 'pageUsers.confirmDeactivate' }
        ];
        c.innerHTML = ui.generateTable(headers, this.users, { actions });
    }

    showCreate() {
        const fn = ['manager','cashier','shop_buyer','stock','sales','none'];
        const content = `
            <form id="user-form">
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>First Name *</label><input type="text" id="u-first" required></div>
                    <div class="form-group"><label>Last Name *</label><input type="text" id="u-last" required></div>
                </div>
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Email *</label><input type="email" id="u-email" required></div>
                    <div class="form-group"><label>Phone *</label><input type="tel" id="u-phone" required></div>
                </div>
                <div class="form-group"><label>Password *</label><input type="password" id="u-pass" required minlength="8"></div>
                <div class="grid-2 gap-3">
                    <div class="form-group">
                        <label>Role *</label>
                        <select id="u-role" required onchange="pageUsers.roleChanged()">
                            <option value="employee">Employee</option>
                            <option value="employer">Employer</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Branch *</label>
                        <select id="u-branch">
                            <option value="">-- select --</option>
                            ${this.branches.map(b => `<option value="${b._id}">${b.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div id="fn-fields">
                    <div class="form-group">
                        <label>Functions (multi-select)</label>
                        <div class="flex flex-wrap gap-2">
                            ${fn.map(f => `<label class="flex items-center gap-1 text-sm"><input type="checkbox" class="u-fn" value="${f}"> ${f}</label>`).join('')}
                        </div>
                    </div>
                    <div class="form-group"><label>Base Salary</label><input type="number" id="u-salary" min="0" step="1"></div>
                </div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageUsers.save()"><i class="fas fa-save"></i> Create</button>
        `;
        ui.showModal('New User', content, footer);
        this.editingId = null;
    }

    roleChanged() {
        const role = document.getElementById('u-role').value;
        document.getElementById('fn-fields').style.display = role === 'employee' ? 'block' : 'none';
    }

   showEdit(index) {
    const u = this.users[index];
    if (!u) return;
    this.editingId = u._id;
    const allRoles = ['manager','cashier','shop_buyer','stock','sales','none'];
    const assignedRoles = u.roles || [];
    const activeRoles = u.activeRoles || [];

    const content = `
        <form id="user-form">
            <div class="grid-2 gap-3">
                <div class="form-group"><label>First Name</label><input type="text" id="u-first" value="${u.firstName}"></div>
                <div class="form-group"><label>Last Name</label><input type="text" id="u-last" value="${u.lastName}"></div>
            </div>
            <div class="form-group"><label>Phone</label><input type="tel" id="u-phone" value="${u.phone || ''}"></div>
            <div class="form-group"><label>Base Salary</label><input type="number" id="u-salary" value="${u.baseSalary || 0}" min="0"></div>

            <div class="form-group">
                <label>Assign / Remove Roles</label>
                <p class="text-xs text-muted mb-2">Check a role to assign it. Uncheck to remove. The "Active" toggle pauses a role without removing it.</p>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr><th>Function</th><th>Assigned</th><th>Active Now</th></tr>
                        </thead>
                        <tbody>
                            ${allRoles.filter(r => r !== 'none').map(fn => `
                                <tr>
                                    <td class="capitalize">${fn.replace('_', ' ')}</td>
                                    <td><input type="checkbox" class="assign-role" value="${fn}" ${assignedRoles.includes(fn) ? 'checked' : ''}></td>
                                    <td><input type="checkbox" class="active-role" value="${fn}" ${activeRoles.includes(fn) ? 'checked' : ''} ${assignedRoles.includes(fn) ? '' : 'disabled'}></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="form-group">
                <label><input type="checkbox" id="u-main-stock" ${u.isMainStock ? 'checked' : ''}> ⭐ Main Stock Personnel (sees cost, can dispatch)</label>
            </div>
        </form>
    `;
    const footer = `
        <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="pageUsers.update()"><i class="fas fa-save"></i> Save Changes</button>
    `;
    ui.showModal('Edit User', content, footer);

    // Enable/disable active checkbox based on assign checkbox
    document.querySelectorAll('.assign-role').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const activeCb = document.querySelector(`.active-role[value="${e.target.value}"]`);
            if (activeCb) {
                activeCb.disabled = !e.target.checked;
                if (!e.target.checked) activeCb.checked = false;
            }
        });
    });
}

    async save() {
        if (this.editingId) {
            const roles = Array.from(document.querySelectorAll('.u-fn:checked')).map(c => c.value);
            const data = {
                firstName: document.getElementById('u-first').value,
                lastName: document.getElementById('u-last').value,
                phone: document.getElementById('u-phone').value,
                roles: roles.length ? roles : undefined,
                baseSalary: parseFloat(document.getElementById('u-salary').value) || 0
            };
            try {
                await usersApi.update(this.editingId, data);
                ui.closeModal();
                ui.showToast('success', 'Saved', 'User updated');
                this.load();
            } catch (err) { ui.showToast('error', 'Error', err.message); }
        } else {
            const roles = Array.from(document.querySelectorAll('.u-fn:checked')).map(c => c.value);
            const data = {
                firstName: document.getElementById('u-first').value,
                lastName: document.getElementById('u-last').value,
                email: document.getElementById('u-email').value,
                phone: document.getElementById('u-phone').value,
                password: document.getElementById('u-pass').value,
                role: document.getElementById('u-role').value,
                roles: roles.length ? roles : undefined,
                isMainStock: document.getElementById('u-main-stock').checked,
                branchId: document.getElementById('u-branch').value || undefined,
                baseSalary: parseFloat(document.getElementById('u-salary').value) || 0
            };
            try {
                await usersApi.create(data);
                ui.closeModal();
                ui.showToast('success', 'Created', 'User created');
                this.load();
            } catch (err) { ui.showToast('error', 'Error', err.message); }
        }
    }

    showClose(index) {
        const u = this.users[index];
        if (!u) return;
        const content = `<form id="close-form"><div class="form-group"><label>Reason *</label><textarea id="close-reason" required></textarea></div></form>`;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-warning" onclick="pageUsers.doClose('${u._id}')">Close Account</button>
        `;
        ui.showModal('Close Account', content, footer);
    }

    async doClose(id) {
        try {
            await usersApi.closeAccount(id, { reason: document.getElementById('close-reason').value });
            ui.closeModal();
            ui.showToast('success', 'Closed', 'Account closed');
            this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    confirmDeactivate(index) {
        const u = this.users[index];
        if (!u) return;
        ui.confirm('Deactivate User', `Deactivate ${u.firstName} ${u.lastName}?`, async () => {
            try { await usersApi.deactivate(u._id); ui.showToast('success', 'Deactivated', 'User deactivated'); this.load(); }
            catch (err) { ui.showToast('error', 'Error', err.message); }
        });
    }
}

const pageUsers = new UsersPage();