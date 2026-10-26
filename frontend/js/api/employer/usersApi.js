const usersApi = {
    list: (params) => api.get(`/users?${qs(params)}`),
    get: (id) => api.get(`/users/${id}`),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    closeAccount: (id, data) => api.put(`/users/${id}/close-account`, data),
    reopenAccount: (id) => api.put(`/users/${id}/reopen-account`),
    deactivate: (id) => api.del(`/users/${id}`),
    resetPassword: (id, data) => api.post(`/users/${id}/reset-password`, data)
};