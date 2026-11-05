class ApplicantsPage {
    async render(container) {
        const companyId = typeof auth.user.company === 'object' ? (auth.user.company._id || auth.user.company.id) : auth.user.company;
        container.innerHTML = `<div class="card"><div class="card-header"><h3>Job applications</h3></div><div class="card-body"><p class="text-secondary">AI suggestions support review only. Review the application yourself before making any hiring or role decision.</p><label>Shareable application link</label><div class="flex gap-2"><input id="application-link" readonly value="${utils.escapeHtml(location.origin + '/apply.html?company=' + companyId)}"><button class="btn btn-secondary" onclick="navigator.clipboard.writeText(document.getElementById('application-link').value)">Copy link</button></div><div id="applicant-list" class="mt-3">${ui.loader()}</div></div></div>`;
        await this.load();
    }
    async load() {
        try {
            const res = await api.get('/applications');
            const el = document.getElementById('applicant-list');
            el.innerHTML = (res.applicants || []).map(a => `<article class="card mb-2"><div class="card-body"><h4>${utils.escapeHtml(a.fullName)} — ${utils.escapeHtml(a.position)}</h4><p>${utils.escapeHtml(a.email)} ${utils.escapeHtml(a.phone || '')} · ${utils.escapeHtml(a.status)}</p><p>${a.aiRecommendation ? utils.escapeHtml(JSON.stringify(a.aiRecommendation)) : 'AI review not requested'}</p><button class="btn btn-secondary" onclick="pageApplicants.view('${a._id}')">View resume</button> <button class="btn btn-secondary" onclick="pageApplicants.analyze('${a._id}')">Analyze with AI</button> <select onchange="pageApplicants.status('${a._id}',this.value)"><option value="">Update status</option>${['reviewed','shortlisted','rejected','hired'].map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div></article>`).join('') || '<p>No applications submitted.</p>';
        } catch (err) { document.getElementById('applicant-list').innerHTML = ui.errorState(err.message); }
    }
    async view(id) { try { const res=await api.get(`/applications/${id}`);const a=res.applicant;ui.showModal('Applicant resume',`<h4>${utils.escapeHtml(a.fullName)} — ${utils.escapeHtml(a.position)}</h4><p>Uploaded documents: ${utils.escapeHtml((a.documents||[]).map(d=>d.name).join(', ')||'None')}</p><pre>${utils.escapeHtml(a.resumeText)}</pre>`,''); } catch(err){ui.showToast('error','Could not load applicant',err.message);} }
    async analyze(id) { try { await api.post(`/applications/${id}/analyze`, {}); ui.showToast('success','AI review complete','Review the recommendation and evidence before deciding.'); await this.load(); } catch (err) { ui.showToast('error','AI review unavailable',err.message); } }
    async status(id, status) { if (!status) return; try { await api.put(`/applications/${id}/status`,{status}); await this.load(); } catch(err) { ui.showToast('error','Could not update status',err.message); } }
}
const pageApplicants = new ApplicantsPage();
