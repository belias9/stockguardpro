document.getElementById('application-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const companyId = new URLSearchParams(location.search).get('company');
    const result = document.getElementById('apply-result');
    if (!/^[a-f\d]{24}$/i.test(companyId || '')) { result.textContent = 'This application link is missing a valid company ID.'; return; }
    const payload = new FormData(event.currentTarget);
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/applications/${encodeURIComponent(companyId)}`, { method: 'POST', body: payload });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not submit application');
        result.textContent = data.message || 'Application submitted.';
        event.currentTarget.reset();
    } catch (error) { result.textContent = error.message; }
});
