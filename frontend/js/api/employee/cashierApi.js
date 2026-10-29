const cashierApi = {
    getSession: () => api.get('/cashier/session'),
    getPending: () => api.get('/cashier/pending'),
    confirm: (id, data) => api.post(`/cashier/confirm/${id}`, data),
    dispute: (id, data) => api.post(`/cashier/dispute/${id}`, data),
    getReport: (date) => api.get(`/cashier/report?date=${date || ''}`),
    close: (data) => api.post('/cashier/close', data),
    listSessions: (params) => api.get(`/cashier/sessions?${qs(params)}`)
};
