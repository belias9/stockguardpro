const authApi = {
    companyLogin: (name, password) => api.post('/auth/company/login', { name, password }),
    userLogin: (email, password, companyId) => api.post('/auth/user/login', { email, password, companyId }),
    registerCompany: (data) => api.post('/auth/register-company', data),
    refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken })
};