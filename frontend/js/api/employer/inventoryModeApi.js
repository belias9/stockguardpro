const inventoryModeApi = {
    list: (params) => api.get(`/inventory-mode?${qs(params)}`),
    get: (id) => api.get(`/inventory-mode/${id}`),
    start: (data) => api.post('/inventory-mode/start', data),
    count: (id, data) => api.post(`/inventory-mode/${id}/count`, data),
    complete: (id) => api.put(`/inventory-mode/${id}/complete`),
    cancel: (id) => api.put(`/inventory-mode/${id}/cancel`)
};