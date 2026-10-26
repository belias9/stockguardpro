const communicationApi = {
    inbox: () => api.get('/communication/inbox'),
    sent: () => api.get('/communication/sent'),
    recipients: () => api.get('/communication/recipients'),
    get: (id) => api.get(`/communication/${id}`),
    send: (data) => api.post('/communication', data),
    respond: (id, data) => api.post(`/communication/${id}/respond`, data),
    resolve: (id, data) => api.put(`/communication/${id}/resolve`, data)
};