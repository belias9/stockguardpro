class StockGuardProApp {
    async init() {
    // Handle special hash routes for auth
    const hash = window.location.hash;
    if (hash.startsWith('#reset-password/') || hash.startsWith('#verify-email/')) {
        await this.handleAuthHashRoute(hash);
        return;
    }
    
    const hasSession = auth.init();

        await partials.inject('loading-screen', 'loading');
        await partials.inject('login-screen', 'login/shell');
        await partials.inject('company-login-step', 'login/company-step');
        await partials.inject('user-login-step', 'login/user-step');
        await partials.inject('register-step', 'login/register-step');
        
        await partials.inject('forgot-password-step', 'login/forgot-password-step');
        await partials.inject('reset-password-step', 'login/reset-password-step');

        setTimeout(async () => {
            document.getElementById('loading-screen').classList.add('hidden');
            if (hasSession) await this.showDashboard();
            else this.showLogin();
        }, 800);

        this.setupLoginListeners();
    }

    async handleAuthHashRoute(hash) {
    await partials.inject('loading-screen', 'loading');
    await partials.inject('login-screen', 'login/shell');
    
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    
    if (hash.startsWith('#reset-password/')) {
        await partials.inject('company-login-step', 'login/reset-password-step');
        document.getElementById('company-login-step').classList.remove('hidden');
        this.setupLoginListeners();
    } else if (hash.startsWith('#verify-email/')) {
        const token = hash.replace('#verify-email/', '');
        try {
            const res = await authApi.verifyEmail(token);
            ui.showToast('success', 'Verified', res.message);
        } catch (err) {
            ui.showToast('error', 'Error', err.message);
        }
        window.location.hash = '';
        setTimeout(() => window.location.reload(), 2000);
    }
    }
        
    

    setupLoginListeners() {
        document.getElementById('company-login-form')?.addEventListener('submit', e => {
            e.preventDefault(); this.handleCompanyLogin();
        });
        document.getElementById('user-login-form')?.addEventListener('submit', e => {
            e.preventDefault(); this.handleUserLogin();
        });
        document.getElementById('register-form')?.addEventListener('submit', e => {
            e.preventDefault(); this.handleRegister();
        });
        document.getElementById('back-to-company')?.addEventListener('click', () => {
            document.getElementById('user-login-step').classList.add('hidden');
            document.getElementById('company-login-step').classList.remove('hidden');
        });
        document.getElementById('show-register')?.addEventListener('click', e => {
            e.preventDefault();
            document.getElementById('company-login-step').classList.add('hidden');
            document.getElementById('register-step').classList.remove('hidden');
        });
        document.getElementById('back-to-login')?.addEventListener('click', () => {
            document.getElementById('register-step').classList.add('hidden');
            document.getElementById('company-login-step').classList.remove('hidden');
        });

        // Forgot password
        document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        try {
            const res = await authApi.forgotPassword(email);
            ui.showToast('success', 'Sent', res.message);
            document.getElementById('forgot-password-step').classList.add('hidden');
            document.getElementById('user-login-step').classList.remove('hidden');
        } catch (err) {
            ui.showToast('error', 'Error', err.message);
        }
        });

        // Back from forgot to user login
        document.getElementById('back-to-user-login')?.addEventListener('click', () => {
            document.getElementById('forgot-password-step').classList.add('hidden');
            document.getElementById('user-login-step').classList.remove('hidden');
        });

        // Reset password form
        document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPass = document.getElementById('reset-new-password').value;
            const confirmPass = document.getElementById('reset-confirm-password').value;
            const statusEl = document.getElementById('reset-status');
            
            if (newPass !== confirmPass) {
                statusEl.innerHTML = '<p class="text-danger">Passwords do not match</p>';
                return;
            }
            
            const token = window.location.hash.replace('#reset-password/', '');
            try {
                const res = await authApi.resetPassword(token, newPass);
                statusEl.innerHTML = '<p class="text-success">' + res.message + '</p>';
                setTimeout(() => {
                    window.location.hash = '';
                    window.location.reload();
                }, 2000);
            } catch (err) {
                statusEl.innerHTML = '<p class="text-danger">' + err.message + '</p>';
            }
        });
        document.getElementById('forgot-password-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('user-login-step').classList.add('hidden');
        document.getElementById('forgot-password-step').classList.remove('hidden');
        });
    }

    async handleCompanyLogin() {
        const name = document.getElementById('company-name').value;
        const password = document.getElementById('company-password').value;
        const res = await auth.companyLogin(name, password);
        if (res.success) {
            document.getElementById('company-login-step').classList.add('hidden');
            document.getElementById('user-login-step').classList.remove('hidden');
            document.querySelector('#selected-company-display span').textContent = res.company.name;
        } else {
            ui.showToast('error', 'Login Failed', res.error);
        }
    }

    async handleUserLogin() {
        const email = document.getElementById('user-email').value;
        const password = document.getElementById('user-password').value;
        const res = await auth.userLogin(email, password);
        if (res.success) await this.showDashboard();
        else ui.showToast('error', 'Login Failed', res.error);
    }

    async handleRegister() {
        const data = {
            name: document.getElementById('reg-company-name').value,
            email: document.getElementById('reg-email').value,
            phone: document.getElementById('reg-phone').value,
            password: document.getElementById('reg-password').value,
            address: { street: document.getElementById('reg-address').value }
        };
        const res = await auth.registerCompany(data);
        if (res.success) {
            ui.showToast('success', 'Welcome', 'Company registered');
            await this.showDashboard();
        } else ui.showToast('error', 'Registration Failed', res.error);
    }

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-dashboard').classList.add('hidden');
    }

    async showDashboard() {
        // Hide login, show dashboard
        document.getElementById('login-screen').classList.add('hidden');
        const dash = document.getElementById('main-dashboard');
        dash.classList.remove('hidden');

        // 1. Load shell partials FIRST (as strings)
        const sidebar = await partials.load('layout/sidebar');
        const topbar = await partials.load('layout/topbar');

        // 2. Build shell and INSERT into DOM
        dash.innerHTML = `
            ${sidebar}
            <main class="main-content">
                ${topbar}
                <div id="page-content" class="page-content"></div>
            </main>
        `;

        // 3. NOW all slots exist — safe to set branch switcher
        if (auth.user.role === 'employer') {
            try {
                const branchHtml = await partials.load('layout/branch-switcher');
                const slot = document.getElementById('branch-switcher-slot');
                if (slot) {
                    slot.innerHTML = branchHtml;
                    const switcher = document.getElementById('branch-switcher');
                    if (switcher) switcher.style.display = 'block';

                    const res = await branchesApi.list();
                    const sel = document.getElementById('branch-select');
                    if (sel) {
                        (res.branches || []).forEach(b => {
                            const opt = document.createElement('option');
                            opt.value = b._id;
                            opt.textContent = `${b.name} (${b.code})`;
                            sel.appendChild(opt);
                        });
                    }
                }
            } catch (err) {
                console.error('Branch switcher failed:', err);
                // Non-fatal — continue
            }
        }

        // 4. Set user info in sidebar
        document.getElementById('sidebar-user-name').textContent = `${auth.user.firstName} ${auth.user.lastName}`;
        document.getElementById('sidebar-user-role').textContent = auth.user.role === 'employer' ? 'Employer' : (auth.user.activeRoles?.[0] || 'Employee');
        document.getElementById('company-name-display').textContent = auth.company.name;

        // 5. Render sidebar menu
        ui.renderSidebar(resolveMenu(auth.user));
        ui.initSidebar();

        // 6. Bind shell listeners
        document.getElementById('logout-btn')?.addEventListener('click', () => auth.logout());
        document.getElementById('sidebar-toggle')?.addEventListener('click', () => ui.toggleSidebar());

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                router.navigate(link.dataset.page);
            });
        });

        // 7. Init socket + sync
        initSocket();
        if (typeof syncManager !== 'undefined') syncManager.start();

        // 8. Register pages
        this.registerPages();

        // 9. Navigate to dashboard
        router.navigate('dashboard');
    }
    async switchBranch(branchId) {
        if (!branchId) {
            auth.setSelectedBranch(null);
        } else {
            const res = await branchesApi.list();
            const branch = (res.branches || []).find(b => b._id === branchId);
            if (branch) auth.setSelectedBranch({ id: branchId, name: branch.name });
        }
        ui.showToast('info', 'Branch switched', branchId ? 'Viewing ' + auth.selectedBranch?.name : 'Viewing all branches');
        router.navigate(router.currentPage || 'dashboard');
}

   registerPages() {
    // Shared pages
    router.register('dashboard', pageDashboard);
    router.register('ai', pageAI);
    router.register('attendance', pageAttendance);
    router.register('salary', pageSalary);
    router.register('messages', pageMessages);
    router.register('settings', pageSettings);

    // Employer pages
    router.register('branches', pageBranches);
    router.register('warehouses', pageWarehouses);
    router.register('users', pageUsers);
    router.register('employees', pageUsers);  // alias
    router.register('inventory', pageInventory);
    router.register('low-stock', pageLowStock);
    router.register('withdrawals', pageWithdrawals);
    router.register('receipts', pageReceipts);
    router.register('inventory-mode', pageInventoryMode);
    router.register('customers', pageCustomers);
    router.register('audit', pageAudit);
    router.register('reports', pageReports);
    router.register('end-of-day', pageEndOfDay);

        // Employee function pages
    router.register('stock-ops', pageStockOps);
    router.register('manager-approvals', pageManagerApprovals);
    router.register('cashier', pageCashier);
    router.register('sales', pageSales);
    router.register('shop-buyer', pageShopBuyer);
    router.register('browse-inventory', pageInventoryBrowse);
}
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new StockGuardProApp();
    window.app.init();
});