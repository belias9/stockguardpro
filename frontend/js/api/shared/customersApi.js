const customersApi = {
    list: (params) => api.get(`/customers?${qs(params)}`),
    get: (id) => api.get(`/customers/${id}`),
    create: (data) => api.post('/customers', data),
    update: (id, data) => api.put(`/customers/${id}`, data),
    addConversation: (id, data) => api.post(`/customers/${id}/conversation`, data),
    orders: (params) => api.get(`/customers/orders/list?${qs(params)}`),
    createOrder: (data) => api.post('/customers/orders', data),
    approveOrder: (id) => api.put(`/customers/orders/${id}/approve`),
    rejectOrder: (id, data) => api.put(`/customers/orders/${id}/reject`, data)
};