const aiApi = {
    insights: (companyData) => api.post('/ai/insights', { companyData }),
    stockQuery: (query) => api.post('/ai/stock-query', { query }),
    assistInput: (inputData) => api.post('/ai/assist-input', { inputData }),
    voiceCommand: (transcript) => api.post('/ai/voice-command', { transcript }),
    predict: (historicalData) => api.post('/ai/predict', { historicalData }),
    report: (payload) => api.post('/ai/report', payload),
    status: () => api.get('/ai/status')
};