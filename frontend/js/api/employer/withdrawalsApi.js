const withdrawalsApi = {
    list: (params) => api.get(`/withdrawals?${qs(params)}`),
    get: (id) => api.get(`/withdrawals/${id}`),
    create: (data) => api.post('/withdrawals', data),
    approve: (id, data) => api.put(`/withdrawals/${id}/approve`, data),
    reject: (id, data) => api.put(`/withdrawals/${id}/reject`, data),
    dispatch: (id, data) => api.put(`/withdrawals/${id}/dispatch`, data),
    receive: (id) => api.put(`/withdrawals/${id}/receive`)
};