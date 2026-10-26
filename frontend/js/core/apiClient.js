class ApiError extends Error {
    constructor(message, status, fields = {}) {
        super(message);
        this.status = status;
        this.fields = fields;
    }
}

class ApiClient {
    constructor(baseURL) { this.baseURL = baseURL; }

    async request(endpoint, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        const url = `${this.baseURL}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            ...(auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}),
            ...(auth.selectedBranch ? { 'X-Branch-Id': auth.selectedBranch.id } : {}),
            ...options.headers
        };

        const config = { method, headers, body: options.body ? JSON.stringify(options.body) : undefined };

        try {
            const res = await fetch(url, config);
            const data = await res.json().catch(() => ({}));

            if (res.status === 401 && auth.refreshToken) {
                const refreshed = await auth.refreshAccessToken();
                if (refreshed) return this.request(endpoint, options);
                auth.logout();
                throw new ApiError('Session expired', 401);
            }

            if (!res.ok) {
                throw new ApiError(data.error || data.message || 'Request failed', res.status, data.errors || {});
            }

            return data;
        } catch (err) {
            if (err instanceof ApiError) throw err;
            throw new ApiError('Network error. Check your connection.', 0);
        }
    }

    get(url) { return this.request(url, { method: 'GET' }); }
    post(url, body) { return this.request(url, { method: 'POST', body }); }
    put(url, body) { return this.request(url, { method: 'PUT', body }); }
    del(url) { return this.request(url, { method: 'DELETE' }); }
}

function qs(params = {}) {
    const parts = [];
    for (const k in params) {
        if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`);
        }
    }
    return parts.join('&');
}

const api = new ApiClient(CONFIG.API_BASE_URL);