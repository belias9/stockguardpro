const CONFIG = {
    API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000/api'
        : '/api',
    SOCKET_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : window.location.origin,
    APP_VERSION: '1.0.0',

    CURRENCY: 'XAF',
    CURRENCY_SYMBOL: 'XAF ',

    STORAGE_KEYS: {
        TOKEN: 'sgp_token',
        REFRESH_TOKEN: 'sgp_refresh_token',
        USER: 'sgp_user',
        COMPANY: 'sgp_company',
        SELECTED_BRANCH: 'sgp_selected_branch'
    }
};