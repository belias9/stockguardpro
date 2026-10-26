const attendanceApi = {
    today: () => api.get('/attendance/today'),
    employee: (id, params) => api.get(`/attendance/employee/${id}?${qs(params)}`),
    clockIn: (data) => api.post('/attendance/clock-in', data),
    clockOut: (data) => api.post('/attendance/clock-out', data),
    absenceReason: (data) => api.post('/attendance/absence-reason', data)
};