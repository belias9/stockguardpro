const dashboardApi = {
    overview: () => api.get('/dashboard/overview'),
    employeeDash: () => api.get('/dashboard/employee-dashboard'),
    structureValue: (params) => api.get(`/dashboard/structure-value?${qs(params)}`),
    companyValue: () => api.get('/dashboard/company-value')
};