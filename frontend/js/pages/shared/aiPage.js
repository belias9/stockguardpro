class AIPage {
    async render(container) {
        const roles = auth.user?.activeRoles || [];
        const isEmployer = auth.user?.role === 'employer';
        const isManager = roles.includes('manager');
        const isMainStock = roles.includes('stock') && auth.user?.isMainStock;
        const title = isEmployer ? 'Company Business Assistant' : isManager ? 'Branch Management Assistant' : isMainStock ? 'Main Stock Assistant' : 'Stock Assistant';
        const intro = isEmployer ? 'Review company-wide business and stock information.' : isManager ? 'Ask about your branch stock and operations.' : isMainStock ? 'Check stock and get help validating new item details.' : 'Ask about stock available to your branch.';
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-body">
                    <div class="flex items-center gap-3">
                        <div style="width:48px;height:48px;border-radius:50%;background:var(--primary-color);display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-robot" style="color:white;font-size:1.25rem;"></i>
                        </div>
                        <div>
                            <h3>${title}</h3>
                            <p class="text-sm text-secondary">${intro}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card mb-4">
                <div class="card-header"><h3><i class="fas fa-search"></i> Ask About Stock</h3></div>
                <div class="card-body">
                    <div class="flex gap-2">
                        <input type="text" id="ai-query" placeholder="e.g. How many items do we have?" class="flex-1">
                        <button class="btn btn-primary" onclick="pageAI.ask()"><i class="fas fa-paper-plane"></i> Ask</button>
                    </div>
                    <div id="ai-response" class="mt-3"></div>
                    ${isEmployer ? '<div class="flex gap-2 mt-3"><button class="btn btn-secondary" onclick="pageAI.companyInsights()"><i class="fas fa-chart-line"></i> Analyze company data</button><button class="btn btn-secondary" onclick="pageAI.predict()"><i class="fas fa-chart-line"></i> Predict stock demand</button><button class="btn btn-secondary" onclick="pageAI.whatsappAnalysis()"><i class="fab fa-whatsapp"></i> WhatsApp group analysis</button></div><p class="text-sm text-secondary mt-2">AI research and predictions are advisory and depend on available records and configured AI credentials.</p>' : ''}
                    ${isMainStock ? '<div class="mt-3"><label for="ai-item-input">Describe a new item for validation</label><input id="ai-item-input" placeholder="e.g. 20 cartons of cooking oil, 1L"><button class="btn btn-secondary mt-2" onclick="pageAI.assistItem()">Suggest item details</button><div id="ai-item-response"></div></div>' : ''}
                </div>
            </div>
        `;
    }

    async companyInsights() {
        const out=document.getElementById('ai-response');out.innerHTML=ui.loader();
        try { const dash=await dashboardApi.overview();const res=await aiApi.insights(dash.overview||{});out.innerHTML=`<pre>${utils.escapeHtml(JSON.stringify(res,null,2))}</pre>`; }
        catch(err){out.innerHTML=`<p class="text-danger">${utils.escapeHtml(err.message)}</p>`;}
    }

    async predict() {
        const out = document.getElementById('ai-response'); out.innerHTML = ui.loader();
        try { const res = await aiApi.predict([]); out.innerHTML = `<pre>${utils.escapeHtml(JSON.stringify(res.predictions, null, 2))}</pre>`; }
        catch (err) { out.innerHTML = `<p class="text-danger">${utils.escapeHtml(err.message)}</p>`; }
    }

    async whatsappAnalysis() {
        const out=document.getElementById('ai-response');out.innerHTML=ui.loader();
        try { const res=await api.get('/whatsapp/analysis?limit=50'); out.innerHTML=`<pre>${utils.escapeHtml(JSON.stringify(res.records||[],null,2))}</pre>`; }
        catch(err){out.innerHTML=`<p class="text-danger">${utils.escapeHtml(err.message)}</p>`;}
    }

    async assistItem() {
        const input=document.getElementById('ai-item-input')?.value?.trim();if(!input)return;
        const out=document.getElementById('ai-item-response');out.innerHTML=ui.loader();
        try { const res=await aiApi.assistInput({description:input});out.innerHTML=`<pre>${utils.escapeHtml(JSON.stringify(res.assistance,null,2))}</pre>`; }
        catch(err){out.innerHTML=`<p class="text-danger">${utils.escapeHtml(err.message)}</p>`;}
    }

    async ask() {
        const q = document.getElementById('ai-query').value;
        if (!q) return;
        const out = document.getElementById('ai-response');
        out.innerHTML = '<div class="loading-spinner" style="width:24px;height:24px;"></div>';
        try {
            const res = await aiApi.stockQuery(q);
            out.innerHTML = `<div class="p-3 rounded" style="background:var(--bg-primary);"><pre class="text-sm">${utils.escapeHtml(JSON.stringify(res.result, null, 2))}</pre></div>`;
        } catch (err) {
            out.innerHTML = `<p class="text-danger">${utils.escapeHtml(err.message)}</p>`;
        }
    }
}

const pageAI = new AIPage();
