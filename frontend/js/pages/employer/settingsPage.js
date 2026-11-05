class SettingsPage {
    constructor() { this.customization = null; }

    async render(container) {
        if (auth.user?.role !== 'employer') return this.renderEmployee(container);
        container.innerHTML = ui.loader();
        try {
            const [res, profile] = await Promise.all([settingsApi.get(), api.get('/company/profile')]);
            this.customization = res.customization;
            this.companyProfile = profile.company;
            this.build(container);
        } catch (err) {
            container.innerHTML = ui.errorState(err.message);
        }
    }

    renderEmployee(container) {
        container.innerHTML = `<div class="card"><div class="card-header"><h3><i class="fas fa-user-cog"></i> My Account Settings</h3></div><div class="card-body">
          <p class="mb-3"><strong>${auth.user.firstName} ${auth.user.lastName}</strong> · ${auth.user.email}</p>
          <h4>Change Password</h4><div class="form-group"><label>Current password</label><input type="password" id="cp-current" autocomplete="current-password"></div>
          <div class="form-group"><label>New password</label><input type="password" id="cp-new" minlength="8" autocomplete="new-password"></div>
          <div class="form-group"><label>Confirm new password</label><input type="password" id="cp-confirm" minlength="8" autocomplete="new-password"></div>
          <button class="btn btn-primary" onclick="pageSettings.changePassword()"><i class="fas fa-save"></i> Change Password</button></div></div>`;
    }

    build(container) {
        const c = this.customization;
        const companySettings = this.companyProfile?.settings || {};
        const reportSections = [
            ['goodsBought', 'Goods bought and purchase records'], ['attendance', 'Attendance summary'],
            ['cashier', 'Branch sales and cashier totals (profit is hidden from managers)'], ['transfers', 'Transfers and withdrawals'],
            ['inventoryAlerts', 'Low and out of stock alerts'], ['faultyGoods', 'Outstanding goods / exceptions'], ['aiInsights', 'AI report insights']
        ];
        const managerSections = this.companyProfile?.settings?.endOfDayManagerSections || ['goodsBought','attendance','cashier','transfers','inventoryAlerts','faultyGoods'];
        container.innerHTML = `
            <div class="card mb-4" id="company-branding">
                <div class="card-header"><h3><i class="fas fa-image"></i> Company Branding</h3></div>
                <div class="card-body"><p class="text-secondary">Upload your company logo or create a simple initials logo. The saved logo is used on company receipts.</p>
                    <div class="flex gap-3 items-center" style="flex-wrap:wrap">
                        ${c.receiptTemplate?.logoUrl ? `<img src="${utils.escapeHtml(utils.resolveAssetUrl(c.receiptTemplate.logoUrl))}" alt="Current company logo" style="max-width:110px;max-height:110px;object-fit:contain" onerror="this.alt='Saved logo could not be loaded';this.style.display='none'">` : '<div class="p-3 rounded" style="background:var(--bg-primary)">No company logo yet</div>'}
                        <div><label class="block mb-2" for="company-logo-file">Choose logo image (PNG, JPEG, or WebP; max 2 MB)</label>
                            <input id="company-logo-file" type="file" accept="image/png,image/jpeg,image/webp" onchange="pageSettings.uploadLogo(this)">
                            <button type="button" class="btn btn-secondary mt-2" onclick="pageSettings.generateLogo()"><i class="fas fa-wand-magic-sparkles"></i> Generate initials logo</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid-2 mb-4">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-tags"></i> Categories</h3>
                        <button class="btn btn-primary btn-sm" onclick="pageSettings.showAddCategory()">+ Add</button>
                    </div>
                    <div class="card-body">
                        ${(c.categories || []).map(cat => `
                            <div class="flex justify-between items-center p-2 mb-1 rounded" style="background:var(--bg-primary);">
                                <span>${cat.name}</span>
                                <button class="btn btn-icon text-danger" onclick="pageSettings.removeCategory('${cat.slug}')"><i class="fas fa-times"></i></button>
                            </div>
                        `).join('') || '<p class="text-muted">No categories</p>'}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-ruler"></i> Units</h3>
                        <button class="btn btn-primary btn-sm" onclick="pageSettings.showAddUnit()">+ Add</button>
                    </div>
                    <div class="card-body">
                        ${(c.units || []).map(u => `
                            <div class="flex justify-between items-center p-2 mb-1 rounded" style="background:var(--bg-primary);">
                                <span>${u.name} ${u.abbreviation ? '(' + u.abbreviation + ')' : ''}</span>
                                <button class="btn btn-icon text-danger" onclick="pageSettings.removeUnit('${u.name}')"><i class="fas fa-times"></i></button>
                            </div>
                        `).join('') || '<p class="text-muted">No units</p>'}
                    </div>
                </div>
            </div>

            <div class="grid-2 mb-4">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-list"></i> Custom Fields</h3>
                        <button class="btn btn-primary btn-sm" onclick="pageSettings.showAddField()">+ Add</button>
                    </div>
                    <div class="card-body">
                        ${(c.customFields || []).map(f => `
                            <div class="flex justify-between items-center p-2 mb-1 rounded" style="background:var(--bg-primary);">
                                <span>${f.label} <small class="text-muted">(${f.key} · ${f.type}${f.required ? ' · required' : ''})</small></span>
                                <button class="btn btn-icon text-danger" onclick="pageSettings.removeField('${f.key}')"><i class="fas fa-times"></i></button>
                            </div>
                        `).join('') || '<p class="text-muted">No custom fields</p>'}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h3><i class="fas fa-money-bill"></i> Currency</h3></div>
                    <div class="card-body">
                        <div class="grid-2 gap-3">
                            <div class="form-group"><label>Code</label><input type="text" id="cur-code" value="${c.currency?.code || 'XAF'}"></div>
                            <div class="form-group"><label>Symbol</label><input type="text" id="cur-symbol" value="${c.currency?.symbol || 'XAF'}"></div>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="pageSettings.saveCurrency()"><i class="fas fa-save"></i> Save Currency</button>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><h3><i class="fas fa-file-alt"></i> Receipt Template</h3></div>
                <div class="card-body">
                    <div class="form-group"><label>Header Text</label><input type="text" id="rt-header" value="${c.receiptTemplate?.headerText || ''}"></div>
                    <div class="form-group"><label>Footer Text</label><input type="text" id="rt-footer" value="${c.receiptTemplate?.footerText || ''}"></div>
                    <div class="flex gap-3 mb-3">
                        <label class="flex items-center gap-1"><input type="checkbox" id="rt-tax" ${c.receiptTemplate?.showTax ? 'checked' : ''}> Show Tax</label>
                        <label class="flex items-center gap-1"><input type="checkbox" id="rt-disc" ${c.receiptTemplate?.showDiscount ? 'checked' : ''}> Show Discount</label>
                        <label class="flex items-center gap-1"><input type="checkbox" id="rt-wh" ${c.receiptTemplate?.showWarehouse ? 'checked' : ''}> Show Warehouse</label>
                    </div>
                    <button class="btn btn-primary" onclick="pageSettings.saveTemplate()"><i class="fas fa-save"></i> Save Template</button>
                </div>
            </div>
            <div class="card mt-4">
                <div class="card-header"><h3><i class="fas fa-clock"></i> Attendance Settings</h3></div>
                <div class="card-body">
                    <div class="grid-2 gap-3">
                        <div class="form-group"><label>Clock-in Time</label><input type="time" id="att-start" value="${companySettings.workingHours?.start || '08:00'}"></div>
                        <div class="form-group"><label>Clock-out Time</label><input type="time" id="att-end" value="${companySettings.workingHours?.end || '17:00'}"></div>
                    </div>
                    <div class="form-group"><label>End-of-day report time</label><input type="time" id="att-eod-time" value="${this.companyProfile?.settings?.endOfDayReportTime || '22:00'}"><small class="text-muted">Saved as the company’s preferred report time; automated delivery still needs a configured delivery integration.</small></div>
                    <div class="grid-2 gap-3">
                        <div class="form-group"><label>Absence Deduction (% per day)</label><input type="number" id="att-ded" min="0" max="100" value="${(companySettings.absenceDeductionRate || 0.1) * 100}"></div>
                        <div class="form-group"><label>Auto-Deduct Absence</label>
                            <select id="att-auto">
                                <option value="true" ${companySettings.autoDeductAbsence ? 'selected' : ''}>Yes</option>
                                <option value="false" ${!companySettings.autoDeductAbsence ? 'selected' : ''}>No</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid-2 gap-3">
                            <div class="form-group"><label>Late Deduction (% of daily rate per hour late)</label>
                                <input type="number" id="att-late" min="0" max="100" value="${(companySettings.lateDeductionRate || 0.5) * 100}"></div>
                            <div class="form-group"><label>Auto-Deduct Late</label>
                                <select id="att-late-auto">
                                    <option value="true" ${companySettings.autoDeductLate ? 'selected' : ''}>Yes</option>
                                    <option value="false" ${!companySettings.autoDeductLate ? 'selected' : ''}>No</option>
                                </select>
                            </div>
                    </div>
                    <div class="form-group"><label>Late Grace Period (minutes)</label>
                            <input type="number" id="att-grace" min="0" value="${companySettings.lateGraceMinutes || 15}">
                            <small class="text-muted">No deduction if late by this many minutes or less</small>
                    </div>
                    <button class="btn btn-primary" onclick="pageSettings.saveAttendance()"><i class="fas fa-save"></i> Save</button>
                </div>
            </div>
            <div class="card mt-4">
                <div class="card-header"><h3><i class="fas fa-clipboard-list"></i> Manager End-of-Day Report Access</h3></div>
                <div class="card-body"><p class="text-secondary">Choose which sections managers may see in saved reports for their own branch. Employers retain the full company report. Profit and cost details are always removed from the manager view.</p>
                    <div class="grid-2 gap-2">${reportSections.map(([key,label]) => `<label class="flex items-center gap-2"><input type="checkbox" class="eod-manager-section" value="${key}" ${managerSections.includes(key) ? 'checked' : ''}> ${label}</label>`).join('')}</div>
                    <button class="btn btn-primary mt-3" onclick="pageSettings.saveManagerReportSettings()"><i class="fas fa-save"></i> Save manager report access</button>
                </div>
            </div>
            <div class="card mt-4"><div class="card-header"><h3><i class="fab fa-whatsapp"></i> WhatsApp group analysis</h3></div><div class="card-body"><p>Only messages delivered by the configured provider webhook from listed groups are analyzed. Tell group members before monitoring; AI findings are suggestions, not automatic actions.</p><div class="form-group"><label>WhatsApp Phone Number ID</label><input id="wa-number-id" value="${utils.escapeHtml(c.whatsappIntegration?.phoneNumberId || '')}"></div><div class="form-group"><label>Monitored group IDs (one per line)</label><textarea id="wa-group-ids" rows="4">${utils.escapeHtml((c.whatsappIntegration?.monitoredGroupIds || []).join('\n'))}</textarea></div><label><input type="checkbox" id="wa-group-enabled" ${c.whatsappIntegration?.groupAnalysisEnabled ? 'checked' : ''}> Enable group message analysis</label><div class="mt-2"><button class="btn btn-primary" onclick="pageSettings.saveWhatsAppGroups()">Save WhatsApp settings</button></div><div id="wa-group-status" class="mt-2"></div></div></div>
            <div class="card mt-4">
                <div class="card-header"><h3><i class="fas fa-fingerprint"></i> Attendance Device</h3></div>
                <div class="card-body">
                    <div id="device-status">${ui.loader()}</div>
                    <div class="mt-3">
                        <label for="attendance-device-type">Attendance method</label>
                        <select id="attendance-device-type" class="mb-2"><option value="phone">Employee phone / browser account</option><option value="biometric_reader">Compatible fingerprint terminal</option></select>
                        <button class="btn btn-primary" onclick="pageSettings.registerDevice()"><i class="fas fa-plus"></i> Register Attendance Device</button>
                        <p class="text-sm text-secondary mt-2">Phone/browser attendance uses the employee’s signed-in account. A fingerprint reader must support a vendor integration that sends authenticated events to StockGuardPro; a generic USB reader cannot be read directly by a website.</p>
                    </div>
                </div>
            </div>
            <div class="card mt-4">
                <div class="card-header"><h3><i class="fas fa-key"></i> Change Password</h3></div>
                <div class="card-body">
                        <div class="form-group">
                            <label>Current Password</label>
                            <input type="password" id="cp-current">
                         </div>
                         <div class="form-group">
                            <label>New Password</label>
                            <input type="password" id="cp-new" minlength="8">
                        </div>
                         <div class="form-group">
                             <label>Confirm New Password</label>
                             <input type="password" id="cp-confirm">
                        </div>
                         <button class="btn btn-primary" onclick="pageSettings.changePassword()">
                             <i class="fas fa-save"></i> Change Password
                        </button>
                </div>
            </div>
        `;  
        this.loadDeviceStatus();
    }
    async saveAttendance() {
        try {
            const settings = {
                workingHours: {
                    start: document.getElementById('att-start').value,
                    end: document.getElementById('att-end').value
                },
                endOfDayReportTime: document.getElementById('att-eod-time').value,
                absenceDeductionRate: parseFloat(document.getElementById('att-ded').value) / 100,
                autoDeductAbsence: document.getElementById('att-auto').value === 'true',
                lateDeductionRate: parseFloat(document.getElementById('att-late').value) / 100,
                autoDeductLate: document.getElementById('att-late-auto').value === 'true',
                lateGraceMinutes: parseInt(document.getElementById('att-grace').value)
            };
            const res = await fetch(`${CONFIG.API_BASE_URL}/company/settings`, {
                method: 'PUT',
                headers: auth.getAuthHeaders(),
                body: JSON.stringify({ settings })
            });
            if (!res.ok) throw new Error('Failed');
            ui.showToast('success', 'Saved', 'Attendance settings updated');
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async saveManagerReportSettings() {
        try {
            const endOfDayManagerSections = [...document.querySelectorAll('.eod-manager-section:checked')].map(input => input.value);
            await api.put('/company/settings', { settings: { endOfDayManagerSections } });
            this.companyProfile.settings.endOfDayManagerSections = endOfDayManagerSections;
            ui.showToast('success', 'Saved', 'Manager report sections updated');
        } catch (err) { ui.showToast('error', 'Could not save report access', err.message); }
    }

    async saveWhatsAppGroups() {
        try {
            const monitoredGroupIds = document.getElementById('wa-group-ids').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
            const res = await api.put('/whatsapp/group-settings', { phoneNumberId: document.getElementById('wa-number-id').value.trim(), monitoredGroupIds, enabled: document.getElementById('wa-group-enabled').checked });
            document.getElementById('wa-group-status').textContent = `Saved. Monitoring ${res.monitoredGroupCount} group(s). Configure provider webhook and app secret on the backend.`;
        } catch (err) { ui.showToast('error','Could not save WhatsApp settings',err.message); }
    }

    async loadDeviceStatus() {
        try {
            const res = await deviceApi.current();
            const el = document.getElementById('device-status');
            if (!el) return;
            if (res.device) {
                el.innerHTML = `
                    <div class="p-3 rounded" style="background:var(--success-light);">
                        <p class="text-sm"><strong>Active:</strong> ${res.device.name}</p>
                        <p class="text-xs text-muted">Device ID: ${res.device.deviceId}</p>
                        <button class="btn btn-sm btn-danger mt-2" onclick="pageSettings.deactivateDevice('${res.device.id}')">Deactivate</button>
                    </div>`;
            } else {
                el.innerHTML = `<p class="text-muted">No device registered</p>`;
            }
        } catch (err) { console.error(err); }
    }

    async registerDevice() {
        const type = document.getElementById('attendance-device-type')?.value || 'phone';
        const name = prompt('Device name:', type === 'biometric_reader' ? 'Fingerprint terminal' : 'Attendance phone');
        if (!name) return;
        try {
            const deviceId = prompt('Unique device ID supplied by the terminal/vendor:', type === 'biometric_reader' ? '' : 'PHONE_' + crypto.randomUUID());
            if (!deviceId) return;
            const res = await deviceApi.register({ name, deviceId, type });
            alert(`Registered. Configure the trusted terminal/vendor to call the backend attendance device-event endpoint over HTTPS.\n\nDevice API key (shown once; store securely on the terminal):\n${res.apiKey}`);
            this.loadDeviceStatus();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async deactivateDevice(id) {
        if (!confirm('Deactivate this device?')) return;
        try { await deviceApi.remove(id); ui.showToast('success', 'Deactivated', 'Done'); this.loadDeviceStatus(); }
        catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    showAddCategory() {
        const content = `<div class="form-group"><label>Category Name</label><input type="text" id="nc-name" required></div>`;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageSettings.addCategory()">Add</button>
        `;
        ui.showModal('Add Category', content, footer);
    }

    async addCategory() {
        try {
            await settingsApi.addCategory({ name: document.getElementById('nc-name').value });
            ui.closeModal(); ui.showToast('success', 'Added', 'Category added');
            this.render(document.getElementById('page-content'));
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async removeCategory(slug) {
        if (!confirm(`Remove category "${slug}"?`)) return;
        try { await settingsApi.removeCategory(slug); ui.showToast('success', 'Removed', 'Category removed'); this.render(document.getElementById('page-content')); }
        catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    showAddUnit() {
        const content = `
            <div class="form-group"><label>Unit Name</label><input type="text" id="nu-name" required></div>
            <div class="form-group"><label>Abbreviation</label><input type="text" id="nu-abbr"></div>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageSettings.addUnit()">Add</button>
        `;
        ui.showModal('Add Unit', content, footer);
    }

    async addUnit() {
        try {
            await settingsApi.addUnit({
                name: document.getElementById('nu-name').value,
                abbreviation: document.getElementById('nu-abbr').value
            });
            ui.closeModal(); ui.showToast('success', 'Added', 'Unit added');
            this.render(document.getElementById('page-content'));
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async removeUnit(name) {
        if (!confirm(`Remove unit "${name}"?`)) return;
        try { await settingsApi.removeUnit(encodeURIComponent(name)); ui.showToast('success', 'Removed', 'Unit removed'); this.render(document.getElementById('page-content')); }
        catch (err) { ui.showToast('error', 'Error', err.message); }
    }
    async changePassword() {
        const current = document.getElementById('cp-current').value;
        const newP = document.getElementById('cp-new').value;
        const confirm = document.getElementById('cp-confirm').value;
        
        if (newP !== confirm) {
            ui.showToast('warning', 'Validation', 'Passwords do not match');
            return;
        }
        if (newP.length < 8) {
            ui.showToast('warning', 'Validation', 'Password must be 8+ characters');
            return;
        }
        
        try {
            await authApi.changePassword(current, newP);
            ui.showToast('success', 'Changed', 'Password updated');
            document.getElementById('cp-current').value = '';
            document.getElementById('cp-new').value = '';
            document.getElementById('cp-confirm').value = '';
        } catch (err) {
            ui.showToast('error', 'Error', err.message);
        }
    }

    showAddField() {
        const content = `
            <div class="grid-2 gap-3">
                <div class="form-group"><label>Key (unique)</label><input type="text" id="nf-key" required placeholder="warranty_months"></div>
                <div class="form-group"><label>Label</label><input type="text" id="nf-label" required placeholder="Warranty (months)"></div>
            </div>
            <div class="form-group"><label>Type</label>
                <select id="nf-type">
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="boolean">Yes/No</option>
                </select>
            </div>
            <div class="form-group"><label><input type="checkbox" id="nf-required"> Required</label></div>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageSettings.addField()">Add</button>
        `;
        ui.showModal('Add Custom Field', content, footer);
    }

    async addField() {
        try {
            await settingsApi.addField({
                key: document.getElementById('nf-key').value.toLowerCase().replace(/\s+/g, '_'),
                label: document.getElementById('nf-label').value,
                type: document.getElementById('nf-type').value,
                required: document.getElementById('nf-required').checked
            });
            ui.closeModal(); ui.showToast('success', 'Added', 'Field added');
            this.render(document.getElementById('page-content'));
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async removeField(key) {
        if (!confirm(`Remove field "${key}"?`)) return;
        try { await settingsApi.removeField(key); ui.showToast('success', 'Removed', 'Field removed'); this.render(document.getElementById('page-content')); }
        catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async saveCurrency() {
        try {
            await settingsApi.updateCurrency({
                code: document.getElementById('cur-code').value,
                symbol: document.getElementById('cur-symbol').value
            });
            ui.showToast('success', 'Saved', 'Currency updated');
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async saveTemplate() {
        try {
            await settingsApi.updateReceiptTemplate({
                headerText: document.getElementById('rt-header').value,
                footerText: document.getElementById('rt-footer').value,
                showTax: document.getElementById('rt-tax').checked,
                showDiscount: document.getElementById('rt-disc').checked,
                showWarehouse: document.getElementById('rt-wh').checked
            });
            ui.showToast('success', 'Saved', 'Template updated');
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
    async uploadLogo(input) {
    if (!input.files?.length) return;
    const file = input.files[0];
    const fd = new FormData();
    fd.append('logo', file);
    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}/logo/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${auth.token}` },
            body: fd
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        ui.showToast('success', 'Uploaded', 'Logo saved');
        await window.app?.refreshCompanyBranding();
        this.render(document.getElementById('page-content'));
    } catch (err) { ui.showToast('error', 'Error', err.message); }
}

    async generateLogo() {
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/logo/generate`, {
                method: 'POST',
                headers: auth.getAuthHeaders()
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            ui.showToast('success', 'Generated', 'Auto-logo created');
            await window.app?.refreshCompanyBranding();
            this.render(document.getElementById('page-content'));
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
}

const pageSettings = new SettingsPage();
