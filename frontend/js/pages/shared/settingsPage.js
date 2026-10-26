class SettingsPage {
    async render(container) {
        if (auth.user?.role !== 'employer') {
            container.innerHTML = ui.errorState('Access denied');
            return;
        }
        container.innerHTML = `
            <div class="card">
                <div class="card-header"><h3><i class="fas fa-cog"></i> Settings</h3></div>
                <div class="card-body">
                    <p class="text-sm"><strong>Company:</strong> ${auth.company.name}</p>
                    <p class="text-sm mt-2"><strong>Email:</strong> ${auth.company.email || '-'}</p>
                    <p class="text-sm mt-2"><strong>User:</strong> ${auth.user.firstName} ${auth.user.lastName}</p>
                </div>
            </div>
        `;
    }
}

const pageSettings = new SettingsPage();