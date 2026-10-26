class AuthManager {
    constructor() {
        this.token = null;
        this.refreshToken = null;
        this.user = null;
        this.company = null;
        this.selectedBranch = null;
        this.isAuthenticated = false;
    }

    init() {
        this.token = localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
        this.refreshToken = localStorage.getItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
        const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
        const companyData = localStorage.getItem(CONFIG.STORAGE_KEYS.COMPANY);
        const branchData = localStorage.getItem(CONFIG.STORAGE_KEYS.SELECTED_BRANCH);

        if (this.token && userData && companyData) {
            try {
                this.user = JSON.parse(userData);
                this.company = JSON.parse(companyData);
                this.selectedBranch = branchData ? JSON.parse(branchData) : null;
                this.isAuthenticated = true;
                return true;
            } catch (e) {
                this.clearSession();
                return false;
            }
        }
        return false;
    }

    async companyLogin(name, password) {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/auth/company/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Company login failed');

            this.company = data.company;
            localStorage.setItem(CONFIG.STORAGE_KEYS.COMPANY, JSON.stringify(data.company));
            return { success: true, company: data.company };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async userLogin(email, password) {
        try {
            if (!this.company) throw new Error('No company selected');

            const res = await fetch(`${CONFIG.API_BASE_URL}/auth/user/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, companyId: this.company.id })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');

            this.token = data.accessToken;
            this.refreshToken = data.refreshToken;
            this.user = data.user;
            this.isAuthenticated = true;

            localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, data.accessToken);
            localStorage.setItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(data.user));

            return { success: true, user: data.user };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async registerCompany(companyData) {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/auth/register-company`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(companyData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');

            this.token = data.accessToken;
            this.refreshToken = data.refreshToken;
            this.user = data.user;
            this.company = data.company;
            this.isAuthenticated = true;

            localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, data.accessToken);
            localStorage.setItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(data.user));
            localStorage.setItem(CONFIG.STORAGE_KEYS.COMPANY, JSON.stringify(data.company));

            return { success: true, data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async refreshAccessToken() {
        try {
            if (!this.refreshToken) throw new Error('No refresh token');
            const res = await fetch(`${CONFIG.API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });
            const data = await res.json();
            if (!res.ok) throw new Error('Refresh failed');
            this.token = data.accessToken;
            this.refreshToken = data.refreshToken;
            localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, data.accessToken);
            localStorage.setItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
            return true;
        } catch {
            this.logout();
            return false;
        }
    }

    setSelectedBranch(branch) {
        this.selectedBranch = branch;
        localStorage.setItem(CONFIG.STORAGE_KEYS.SELECTED_BRANCH, JSON.stringify(branch));
    }

    logout() {
        this.clearSession();
        window.location.reload();
    }

    clearSession() {
        this.token = null;
        this.refreshToken = null;
        this.user = null;
        this.company = null;
        this.selectedBranch = null;
        this.isAuthenticated = false;
        Object.values(CONFIG.STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    }

    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
            ...(this.selectedBranch ? { 'X-Branch-Id': this.selectedBranch.id } : {})
        };
    }

    hasRole(role) { return this.user?.role === role; }
    hasFunction(fn) { return this.user?.activeRoles?.includes(fn); }
}

const auth = new AuthManager();