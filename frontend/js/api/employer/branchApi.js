const branchesApi = {
    list: () => api.get('/branches'),
    get: (id) => api.get(`/branches/${id}`),
    create: (data) => api.post('/branches', data),
    update: (id, data) => api.put(`/branches/${id}`, data),
    deactivate: (id) => api.del(`/branches/${id}`)
};

const warehousesApi = {
    list: (params) => api.get(`/warehouses?${qs(params)}`),
    create: (data) => api.post('/warehouses', data),
    update: (id, data) => api.put(`/warehouses/${id}`, data),
    deactivate: (id) => api.del(`/warehouses/${id}`)
};