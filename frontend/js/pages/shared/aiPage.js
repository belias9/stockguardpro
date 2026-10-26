class AIPage {
    async render(container) {
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-body">
                    <div class="flex items-center gap-3">
                        <div style="width:48px;height:48px;border-radius:50%;background:var(--primary-color);display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-robot" style="color:white;font-size:1.25rem;"></i>
                        </div>
                        <div>
                            <h3>AI Assistant</h3>
                            <p class="text-sm text-secondary">Ask about stock, get insights</p>
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
                </div>
            </div>
        `;
    }

    async ask() {
        const q = document.getElementById('ai-query').value;
        if (!q) return;
        const out = document.getElementById('ai-response');
        out.innerHTML = '<div class="loading-spinner" style="width:24px;height:24px;"></div>';
        try {
            const res = await aiApi.stockQuery(q);
            out.innerHTML = `<div class="p-3 rounded" style="background:var(--bg-primary);"><pre class="text-sm">${JSON.stringify(res.result, null, 2)}</pre></div>`;
        } catch (err) {
            out.innerHTML = `<p class="text-danger">${err.message}</p>`;
        }
    }
}

const pageAI = new AIPage();