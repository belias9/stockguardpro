const receiptsApi = {
    list: (params) => api.get(`/receipts?${qs(params)}`),
    get: (id) => api.get(`/receipts/${id}`),
    create: (data) => api.post('/receipts', data),
    confirmPayment: (id, data) => api.put(`/receipts/${id}/confirm-payment`, data),
    disputePayment: (id, data) => api.put(`/receipts/${id}/dispute-payment`, data),
    cancel: (id, data) => api.put(`/receipts/${id}/cancel`, data),
    approveBelowPrice: (id, data) => api.put(`/receipts/price-approval/${id}/approve`, data)
};