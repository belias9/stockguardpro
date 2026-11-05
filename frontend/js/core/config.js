const isLocalFrontend = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const isFrontendDevServer = window.location.port === '3000';
const backendOrigin = isFrontendDevServer
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : (isLocalFrontend ? `${window.location.protocol}//${window.location.hostname}:5000` : window.location.origin);

const CONFIG = {
    // The frontend dev server (including access over a LAN IP) does not proxy
    // API requests. Point it directly at the backend instead of requesting
    // /api from the static frontend server, which returns index.html.
    API_BASE_URL: `${backendOrigin}/api`,
    SOCKET_URL: backendOrigin,
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
