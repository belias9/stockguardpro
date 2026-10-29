const authApi = {
    companyLogin: (name, password) => api.post('/auth/company/login', { name, password }),
    userLogin: (email, password, companyId) => api.post('/auth/user/login', { email, password, companyId }),
    registerCompany: (data) => api.post('/auth/register-company', data),
    refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
    // New:
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (token, newPassword) => api.post(`/auth/reset-password/${token}`, { newPassword }),
    changePassword: (currentPassword, newPassword) => api.put('/auth/change-password', { currentPassword, newPassword }),
    sendVerification: () => api.post('/auth/send-verification'),
    verifyEmail: (token) => api.get(`/auth/verify-email/${token}`)
};