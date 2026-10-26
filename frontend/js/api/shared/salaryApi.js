const salaryApi = {
    list: (params) => api.get(`/salary?${qs(params)}`),
    generate: (data) => api.post('/salary/generate', data),
    pay: (id, data) => api.put(`/salary/${id}/pay`, data),
    addBonus: (id, data) => api.post(`/salary/${id}/bonus`, data),
    approveBonus: (id, data) => api.put(`/salary/${id}/bonus-approval`, data),
    requestAdvance: (data) => api.post('/salary/advance', data),
    approveAdvance: (id, data) => api.put(`/salary/${id}/advance`, data),
    dispute: (id, data) => api.post(`/salary/${id}/dispute`, data),
    resolveDispute: (id, idx, data) => api.put(`/salary/${id}/dispute/${idx}`, data)
};