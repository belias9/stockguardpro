class Router {
    constructor() {
        this.routes = {};
        this.pendingParams = {};
        window.addEventListener('hashchange', () => this.handle());
    }

    register(pageName, pageInstance) { this.routes[pageName] = pageInstance; }

    navigate(pageName, params = {}) {
        this.pendingParams = params;
        if (window.location.hash === `#${pageName}`) this.handle();
        else window.location.hash = pageName;
    }

    async handle() {
        const pageName = window.location.hash.replace('#', '') || 'dashboard';
        const page = this.routes[pageName];
        const title = document.getElementById('page-title');
        const navItem = [...document.querySelectorAll('.nav-link')].find(link => link.dataset.page === pageName);
        const fallbackTitles = {
            dashboard: 'Dashboard', 'end-of-day': 'End of Day Report', 'branch-detail': 'Branches & Warehouses',
            'employees-by-branch': 'Employees by Branch', 'browse-inventory': 'Browse Items', 'stock-ops': 'Stock Operations',
            'manager-approvals': 'Manager Approvals', 'shop-buyer': 'Purchases', 'inventory-mode': 'Inventory Mode',
            'low-stock': 'Low Stock'
        };
        const pageTitle = navItem?.textContent.trim() || fallbackTitles[pageName] || pageName.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        if (title) title.textContent = pageTitle;
        document.title = `${pageTitle} · StockGuardPro`;
        if (!page) return this.render404(pageName);
        if (typeof access !== 'undefined' && !access.canAccess(pageName)) {
            ui.showToast('warning', 'Access Denied', 'No permission');
            return this.navigate('dashboard');
        }

        const container = document.getElementById('page-content');
        if (!container) return;
        container.innerHTML = ui.loader();

        try {
            await page.render(container, this.pendingParams);
            this.pendingParams = {};
            document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === pageName));
            if (window.matchMedia('(max-width: 1024px)').matches) ui.closeMobileSidebar();
        } catch (err) {
            console.error(err);
            container.innerHTML = ui.errorState(err.message);
        }
    }

    render404(name) {
        const c = document.getElementById('page-content');
        if (c) c.innerHTML = `<div class="text-center p-5"><h3>Page Not Found: ${name}</h3></div>`;
    }
}

const router = new Router();
