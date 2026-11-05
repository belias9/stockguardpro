class PoliciesPage {
    async render(container) {
        this.container = container;
        const employer = auth.user?.role === 'employer';
        container.innerHTML = `<div class="card mb-3"><div class="card-header"><h3>Company policies, regulations & certificates</h3>${employer ? '<button class="btn btn-primary" onclick="pagePolicies.showCreate()">Add document</button>' : ''}</div><div class="card-body"><p class="text-secondary">Acknowledgment is recorded against your signed-in account. It is not a fingerprint or legally certified signature.</p><div id="policy-list">${ui.loader()}</div></div></div>`;
        await this.load();
    }
    async load() {
        try {
            const response = await api.get('/policies');
            const list = document.getElementById('policy-list');
            list.innerHTML = (response.policies || []).map(p => `<article class="card mb-2"><div class="card-body"><h4>${utils.escapeHtml(p.title)} <small>(${utils.escapeHtml(p.kind)}, v${p.version})</small></h4><p>${utils.escapeHtml(p.body)}</p>${p.hasFile ? `<button class="btn btn-secondary" onclick="pagePolicies.downloadFile('${p._id}')">Download ${utils.escapeHtml(p.fileName||'document')}</button>` : ''}${p.documentUrl ? `<p><a href="${utils.escapeHtml(p.documentUrl)}" target="_blank" rel="noopener">Open attached document</a></p>` : ''}${p.requiresAcknowledgment ? (p.acknowledged ? '<span class="badge badge-success">Acknowledged</span>' : `<button class="btn btn-primary" onclick="pagePolicies.acknowledge('${p._id}')">I have read and acknowledge</button>`) : ''}</div></article>`).join('') || '<p>No active company documents.</p>';
            if (auth.user?.role === 'employee') {
                const pending=(response.policies||[]).some(p=>p.requiresAcknowledgment&&!p.acknowledged);
                auth.user.mustAcknowledgePolicies=pending;localStorage.setItem(CONFIG.STORAGE_KEYS.USER,JSON.stringify(auth.user));
                if(!pending)router.navigate('dashboard');
            }
        } catch (err) { document.getElementById('policy-list').innerHTML = ui.errorState(err.message); }
    }
    showCreate() {
        ui.showModal('Add company document', `<div class="form-group"><label>Title</label><input id="pol-title" maxlength="160"></div><div class="form-group"><label>Type</label><select id="pol-kind"><option value="policy">Policy</option><option value="regulation">Regulation</option><option value="certificate">Certificate</option></select></div><div class="form-group"><label>Document text / policy terms</label><textarea id="pol-body" rows="8" maxlength="20000"></textarea></div><div class="form-group"><label>Upload PDF/JPEG/PNG (max 5 MB)</label><input id="pol-file" type="file" accept="application/pdf,image/jpeg,image/png"></div><div class="form-group"><label>Optional document URL</label><input id="pol-url" type="url"></div><label><input id="pol-ack" type="checkbox" checked> Require employee acknowledgment</label>`, `<button class="btn btn-primary" onclick="pagePolicies.create()">Save</button>`);
    }
    async create() {
        try {
            const file = document.getElementById('pol-file').files[0];
            if (file) {
                const form = new FormData(); form.append('title',document.getElementById('pol-title').value); form.append('kind',document.getElementById('pol-kind').value); form.append('body',document.getElementById('pol-body').value); form.append('requiresAcknowledgment',String(document.getElementById('pol-ack').checked)); form.append('file',file);
                const headers=auth.getAuthHeaders(); delete headers['Content-Type'];
                const res=await fetch(`${CONFIG.API_BASE_URL}/policies/upload`,{method:'POST',headers,body:form}); const data=await res.json(); if(!res.ok)throw new Error(data.error||'Upload failed');
            } else await api.post('/policies', { title: document.getElementById('pol-title').value, kind: document.getElementById('pol-kind').value, body: document.getElementById('pol-body').value, documentUrl: document.getElementById('pol-url').value, requiresAcknowledgment: document.getElementById('pol-ack').checked });
            ui.closeModal(); await this.load();
        }
        catch (err) { ui.showToast('error', 'Could not save document', err.message); }
    }
    async downloadFile(id) {
        try { const headers=auth.getAuthHeaders();delete headers['Content-Type'];const res=await fetch(`${CONFIG.API_BASE_URL}/policies/${id}/file`,{headers});if(!res.ok)throw new Error('Download failed');const blob=await res.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='company-document';a.click();URL.revokeObjectURL(a.href); }
        catch(err){ui.showToast('error','Could not download document',err.message);}
    }
    async acknowledge(id) {
        try { const result = await api.post(`/policies/${id}/acknowledge`, {}); ui.showToast('success', 'Acknowledged', result.note); await this.load(); }
        catch (err) { ui.showToast('error', 'Could not acknowledge', err.message); }
    }
}
const pagePolicies = new PoliciesPage();
