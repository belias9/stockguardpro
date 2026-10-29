const preRecordApi = {
    list: (params) => api.get(`/pre-records?${qs(params)}`),
    get: (id) => api.get(`/pre-records/${id}`),
    create: (data) => api.post('/pre-records', data),
    update: (id, data) => api.put(`/pre-records/${id}`, data),
    confirm: (id, data) => api.put(`/pre-records/${id}/confirm`, data),
    reject: (id, data) => api.put(`/pre-records/${id}/reject`, data)
};
