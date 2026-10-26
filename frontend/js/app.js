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
        // Stub page for S31+S32 — real pages come in S35+
        router.register('dashboard', {
            render: async (container) => {
                container.innerHTML = `
                    <div class="card">
                        <div class="card-header"><h3>Welcome, ${auth.user.firstName}!</h3></div>
                        <div class="card-body">
                            <p>You are logged in as <strong>${auth.user.role}</strong>.</p>
                            <p class="text-muted mt-2">Pages for this role will be built in upcoming segments.</p>
                            <div class="mt-4 p-3 rounded" style="background:var(--primary-light);">
                                <p class="text-sm"><strong>Company:</strong> ${auth.company.name}</p>
                                <p class="text-sm"><strong>User ID:</strong> ${auth.user.id}</p>
                                <p class="text-sm"><strong>Employee ID:</strong> ${auth.user.employeeId || 'N/A'}</p>
                                <p class="text-sm"><strong>Roles:</strong> ${(auth.user.activeRoles || []).join(', ') || 'employer'}</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new StockGuardProApp();
    window.app.init();
});