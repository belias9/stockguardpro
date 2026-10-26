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