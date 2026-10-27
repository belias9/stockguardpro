const auditApi = {
    list: (params) => api.get(`/audit?${qs(params)}`),
    summary: (params) => api.get(`/audit/summary?${qs(params)}`),
    export: (params) => api.get(`/audit/export?${qs(params)}`),
    getUserLogs: (userId, params) => api.get(`/audit/user/${userId}?${qs(params)}`)
};