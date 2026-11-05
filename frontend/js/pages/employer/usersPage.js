class UsersPage {
    constructor() { this.users = []; this.branches = []; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-users"></i> Employees & Roles</h3>
                    <button class="btn btn-primary" onclick="pageUsers.showCreate()"><i class="fas fa-user-plus"></i> New User</button>
                </div>
                <div class="card-body"><div id="users-table">${ui.loader()}</div></div>
            </div>`;
        await Promise.all([this.loadBranches(), this.load()]);
    }

    async loadBranches() {
        try { this.branches = (await branchesApi.list()).branches?.filter(b => b.isActive) || []; }
        catch { this.branches = []; }
    }

    async load() {
        try {
            const res = await usersApi.list({ limit: 200 });
            this.users = res.users || [];
            this.renderTable();
        } catch (err) { document.getElementById('users-table').innerHTML = ui.errorState(err.message); }
    }

    renderTable() {
        const c = document.getElementById('users-table');
        if (!this.users.length) { c.innerHTML = ui.emptyState('No users', 'fa-users'); return; }
        const headers = [
            { key: 'employeeId', label: 'ID', format: v => v || '-' },
            { key: 'firstName', label: 'First' },
            { key: 'lastName', label: 'Last' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role' },
            { key: 'activeRoles', label: 'Functions', format: v => (v || []).join(', ') || '-' },
            { key: 'isMainStock', label: 'Main', format: v => v ? '⭐' : '-' },
            { key: 'branch', label: 'Branch', format: v => v?.name || '-' }
        ];
        const actions = [
            { icon: 'fa-edit', title: 'Edit', class: 'text-primary', handler: 'pageUsers.showEdit' },
            { icon: 'fa-trash', title: 'Deactivate', class: 'text-danger', condition: r => r.isActive, handler: 'pageUsers.confirmDeactivate' }
        ];
        c.innerHTML = ui.generateTable(headers, this.users, { actions });
    }

    showCreate() {
        const fn = ['manager','cashier','shop_buyer','stock','sales','accounting','none'];
        const content = `
            <form id="uc-form">
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>First Name *</label><input type="text" id="uc-first" required></div>
                    <div class="form-group"><label>Last Name *</label><input type="text" id="uc-last" required></div>
                </div>
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Email *</label><input type="email" id="uc-email" required></div>
                    <div class="form-group"><label>Phone *</label><input type="tel" id="uc-phone" required></div>
                </div>
                <div class="form-group"><label>Password *</label><input type="password" id="uc-pass" required minlength="8"></div>
                <div class="grid-2 gap-3">
                    <div class="form-group"><label>Role *</label>
                        <select id="uc-role" required>
                            <option value="employee">Employee</option>
                            <option value="employer">Employer</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Branch</label>
                        <select id="uc-branch">
                            <option value="">-- select --</option>
                            ${this.branches.map(b => `<option value="${b._id || b.id}">${b.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Functions (select one or more)</label>
                    <div class="flex flex-wrap gap-2">
                        ${fn.map(f => `<label class="flex items-center gap-1 text-sm"><input type="checkbox" class="uc-fn" value="${f}"> ${f.replace('_', ' ')}</label>`).join('')}
                    </div>
                </div>
                <div class="form-group"><label>Base Salary</label><input type="number" id="uc-salary" min="0" step="1" value="0"></div>
            </form>`;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageUsers.create()"><i class="fas fa-user-plus"></i> Create User</button>`;
        ui.showModal('New User', content, footer);
    }

    async create() {
        const firstName = document.getElementById('uc-first').value.trim();
        const lastName = document.getElementById('uc-last').value.trim();
        const email = document.getElementById('uc-email').value.trim();
        const phone = document.getElementById('uc-phone').value.trim();
        const password = document.getElementById('uc-pass').value;
        const role = document.getElementById('uc-role').value;
        const branchId = document.getElementById('uc-branch').value;
        const roles = Array.from(document.querySelectorAll('.uc-fn:checked')).map(c => c.value);
        const salary = parseFloat(document.getElementById('uc-salary')?.value) || 0;

        if (!firstName || !lastName || !email || !phone || !password) {
            ui.showToast('warning', 'Validation', 'Fill all required fields'); return;
        }
        if (role === 'employee' && (!branchId || !roles.length)) {
            ui.showToast('warning', 'Validation', 'Employee needs branch + at least one role'); return;
        }

        try {
            await usersApi.create({
                firstName, lastName, email, phone, password, role,
                branchId: role === 'employee' ? branchId : undefined,
                roles: role === 'employee' ? roles : undefined,
                baseSalary: salary
            });
            ui.closeModal(); ui.showToast('success', 'Created', 'User created'); this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    showEdit(index) {
        const u = this.users[index];
        if (!u) return;
        this.editingId = u.id || u._id;
        const allRoles = ['manager','cashier','shop_buyer','stock','sales','accounting'];
        const assigned = u.roles || [];
        const active = u.activeRoles || [];
        const content = `
            <div class="grid-2 gap-3">
                <div class="form-group"><label>First</label><input type="text" id="ue-first" value="${u.firstName}"></div>
                <div class="form-group"><label>Last</label><input type="text" id="ue-last" value="${u.lastName}"></div>
            </div>
            <div class="form-group"><label>Phone</label><input type="tel" id="ue-phone" value="${u.phone || ''}"></div>
            <div class="form-group"><label>Base Salary</label><input type="number" id="ue-salary" value="${u.baseSalary || 0}" min="0"></div>

            <h4 class="mt-3 mb-2">Assign / Remove Roles</h4>
            <p class="text-xs text-muted mb-2">Check to assign a function. Uncheck to remove.</p>
            <div class="table-container">
                <table>
                    <thead><tr><th>Function</th><th>Assigned</th><th>Active Now</th></tr></thead>
                    <tbody>
                        ${allRoles.map(fn => `
                            <tr>
                                <td class="capitalize">${fn.replace('_', ' ')}</td>
                                <td><input type="checkbox" class="ue-assign" value="${fn}" ${assigned.includes(fn) ? 'checked' : ''}></td>
                                <td><input type="checkbox" class="ue-active" value="${fn}" ${active.includes(fn) ? 'checked' : ''} ${assigned.includes(fn) ? '' : 'disabled'}></td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <div class="form-group mt-3">
                <label><input type="checkbox" id="ue-main" ${u.isMainStock ? 'checked' : ''}> ⭐ Main Stock Personnel</label>
            </div>`;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageUsers.save()"><i class="fas fa-save"></i> Save Changes</button>`;
        ui.showModal('Edit User', content, footer);

        document.querySelectorAll('.ue-assign').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const ac = document.querySelector(`.ue-active[value="${e.target.value}"]`);
                if (ac) { ac.disabled = !e.target.checked; if (!e.target.checked) ac.checked = false; }
            });
        });
    }

    async save() {
        const roles = Array.from(document.querySelectorAll('.ue-assign:checked')).map(c => c.value);
        const active = Array.from(document.querySelectorAll('.ue-active:checked')).map(c => c.value);
        const data = {
            firstName: document.getElementById('ue-first').value,
            lastName: document.getElementById('ue-last').value,
            phone: document.getElementById('ue-phone').value,
            baseSalary: parseFloat(document.getElementById('ue-salary').value) || 0,
            isMainStock: document.getElementById('ue-main').checked,
            roles: roles.length ? roles : ['none'],
            activeRoles: active
        };
        try {
            await usersApi.update(this.editingId, data);
            ui.closeModal(); ui.showToast('success', 'Updated', 'User saved'); this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    confirmDeactivate(index) {
        const u = this.users[index];
        if (!u) return;
        ui.confirm('Deactivate', `Deactivate ${u.firstName}?`, async () => {
            try { await usersApi.deactivate(u.id || u._id); ui.showToast('success', 'Deactivated', 'Done'); this.load(); }
            catch (err) { ui.showToast('error', 'Error', err.message); }
        });
    }
}
const pageUsers = new UsersPage();
