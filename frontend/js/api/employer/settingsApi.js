const settingsApi = {
    get: () => api.get('/settings'),
    addCategory: (data) => api.post('/settings/categories', data),
    removeCategory: (slug) => api.del(`/settings/categories/${slug}`),
    addUnit: (data) => api.post('/settings/units', data),
    removeUnit: (name) => api.del(`/settings/units/${name}`),
    addField: (data) => api.post('/settings/fields', data),
    removeField: (key) => api.del(`/settings/fields/${key}`),
    updateCurrency: (data) => api.put('/settings/currency', data),
    updateReceiptTemplate: (data) => api.put('/settings/receipt-template', data)
};