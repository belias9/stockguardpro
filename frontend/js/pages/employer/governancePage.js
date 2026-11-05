const employerScopes = ['governance','people','workforce','accounting','inventory','operations','communications','analytics','administration'];
class GovernancePage {
    async render(container) {
        container.innerHTML = `<div class="card mb-3"><div class="card-header"><h3>Company ownership & governance</h3></div><div class="card-body"><p>Set the company structure and ownership register. Confirm percentages against legal documents with your adviser.</p><div class="grid-2 gap-3"><label>Company structure<select id="gov-structure"><option value="private">Private company</option><option value="joint_stock">Joint-stock / shareholder company</option></select></label><label>Shareholders as JSON<textarea id="gov-shareholders" rows="9" placeholder='[{"name":"Example Owner","shares":100,"ownershipPercent":100,"votingPercent":100}]'></textarea></label></div><button class="btn btn-primary mt-2" onclick="pageGovernance.saveGovernance()">Save ownership</button></div></div><div class="card"><div class="card-header"><h3>Co-employer access</h3></div><div class="card-body"><p>The primary employer controls which company areas additional employer accounts can access.</p><div id="co-employers">${ui.loader()}</div></div></div>`;
        await this.load();
    }
    async load() {
        try {
            const [g, e] = await Promise.all([api.get('/company/governance'), api.get('/company/employers')]);
            document.getElementById('gov-structure').value = g.governance?.structure || 'private';
            document.getElementById('gov-shareholders').value = JSON.stringify(g.governance?.shareholders || [], null, 2);
            const box = document.getElementById('co-employers');
            box.innerHTML = (e.employers || []).map(u => `<div class="card mb-2"><div class="card-body"><strong>${utils.escapeHtml(u.firstName)} ${utils.escapeHtml(u.lastName)}${u.isPrimary ? ' (Primary employer)' : ''}</strong>${u.isPrimary ? '' : `<div class="grid-2 mt-2">${employerScopes.map(s => `<label><input type="checkbox" class="employer-scope" data-user="${u._id}" value="${s}" ${(u.employerPermissions||[]).includes(s)?'checked':''}> ${s}</label>`).join('')}</div><button class="btn btn-secondary mt-2" onclick="pageGovernance.saveScopes('${u._id}')">Save access</button>`}</div></div>`).join('');
        } catch (err) { document.getElementById('co-employers').innerHTML = ui.errorState(err.message); }
    }
    async saveGovernance() {
        try { const shareholders = JSON.parse(document.getElementById('gov-shareholders').value || '[]'); await api.put('/company/governance', { structure: document.getElementById('gov-structure').value, shareholders }); ui.showToast('success','Saved','Company governance updated'); }
        catch (err) { ui.showToast('error','Could not save governance',err.message); }
    }
    async saveScopes(id) {
        try { const permissions = Array.from(document.querySelectorAll(`.employer-scope[data-user="${id}"]:checked`)).map(x=>x.value); await api.put(`/company/employers/${id}/permissions`,{permissions}); ui.showToast('success','Saved','Co-employer access updated'); }
        catch (err) { ui.showToast('error','Could not save access',err.message); }
    }
}
const pageGovernance = new GovernancePage();
