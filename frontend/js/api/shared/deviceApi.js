const deviceApi = {
    current: () => api.get('/devices/current'),
    register: (data) => api.post('/devices/register', data),
    remove: (id) => api.del(`/devices/${id}`)
};
