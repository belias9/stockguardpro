class SettingsPage {
    constructor() { this.customization = null; }

    async render(container) {
        container.innerHTML = ui.loader();
        try {
            const res = await settingsApi.get();
            this.customization = res.customization;
            this.build(container);
        } catch (err) {
            container.innerHTML = ui.errorState(err.message);
        }
    }

    build(container) {
        const c = this.customization;
        container.innerHTML = `
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
        `;
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
}

const pageSettings = new SettingsPage();