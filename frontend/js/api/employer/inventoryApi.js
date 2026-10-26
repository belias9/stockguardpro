const inventoryApi = {
    list: (params) => api.get(`/inventory?${qs(params)}`),
    lowStock: () => api.get('/inventory/low-stock'),
    get: (id) => api.get(`/inventory/${id}`),
    create: (data) => api.post('/inventory', data),
    update: (id, data) => api.put(`/inventory/${id}`, data),
    adjust: (id, data) => api.post(`/inventory/${id}/adjust`, data),
    remove: (id) => api.del(`/inventory/${id}`)
};