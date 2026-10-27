class StockGuardProApp {
    async init() {
        const hasSession = auth.init();

        await partials.inject('loading-screen', 'loading');
        await partials.inject('login-screen', 'login/shell');
        await partials.inject('company-login-step', 'login/company-step');
        await partials.inject('user-login-step', 'login/user-step');
        await partials.inject('register-step', 'login/register-step');

        setTimeout(async () => {
            document.getElementById('loading-screen').classList.add('hidden');
            if (hasSession) await this.showDashboard();
            else this.showLogin();
        }, 800);

        this.setupLoginListeners();
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
        document.getElementById('login-screen').classList.add('hidden');
        const dash = document.getElementById('main-dashboard');
        dash.classList.remove('hidden');

        const sidebar = await partials.load('layout/sidebar');
        const topbar = await partials.load('layout/topbar');
        dash.innerHTML = `
            ${sidebar}
            <main class="main-content">
                ${topbar}
                <div id="page-content" class="page-content"></div>
            </main>
        `;

        document.getElementById('sidebar-user-name').textContent = `${auth.user.firstName} ${auth.user.lastName}`;
        document.getElementById('sidebar-user-role').textContent = auth.user.role === 'employer' ? 'Employer' : (auth.user.activeRoles?.[0] || 'Employee');
        document.getElementById('company-name-display').textContent = auth.company.name;

        ui.renderSidebar(resolveMenu(auth.user));
        ui.initSidebar();

        document.getElementById('logout-btn')?.addEventListener('click', () => auth.logout());
        document.getElementById('sidebar-toggle')?.addEventListener('click', () => ui.toggleSidebar());

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                router.navigate(link.dataset.page);
            });
        });

        initSocket();
        this.registerPages();
        router.navigate('dashboard');
    }

    registerPages() {
    // Shared pages
    router.register('dashboard', pageDashboard);
    router.register('ai', pageAI);
    router.register('attendance', pageAttendance);
    router.register('salary', pageSalary);
    router.register('messages', pageMessages);
    router.register('settings', pageSettings);

    // Employer pages (registered for all — accessMap handles permissions)
    router.register('branches', pageBranches);
    router.register('warehouses', pageWarehouses);
    router.register('users', pageUsers);
    router.register('inventory', pageInventory);
    router.register('withdrawals', pageWithdrawals);
    router.register('receipts', pageReceipts);
    router.register('inventory-mode', pageInventoryMode);
    router.register('customers', pageCustomers);
    router.register('audit', pageAudit);
    router.register('reports', pageReports);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new StockGuardProApp();
    window.app.init();
});