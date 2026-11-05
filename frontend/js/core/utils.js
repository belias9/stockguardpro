/**
 * Small utility functions used across pages.
 */
const utils = {
    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    },
    resolveAssetUrl(value) {
        if (!value) return '';
        try {
            const apiOrigin = new URL(CONFIG.API_BASE_URL, window.location.origin).origin;
            const resolved = new URL(String(value), apiOrigin);
            // Old saved logos may contain localhost from when they were set
            // up on the server computer. Rebase those paths for every device.
            if (['localhost', '127.0.0.1'].includes(resolved.hostname) && resolved.pathname.startsWith('/uploads/')) {
                resolved.host = new URL(apiOrigin).host;
                resolved.protocol = new URL(apiOrigin).protocol;
            }
            return ['http:', 'https:'].includes(resolved.protocol) ? resolved.toString() : '';
        } catch {
            return '';
        }
    },
    // Debounce
    debounce(fn, wait = 300) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), wait);
        };
    },

    // Capitalize
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
    },

    // Truncate
    truncate(str, len = 50) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '…' : str;
    },

    // Parse query string
    parseQuery(qs) {
        const params = new URLSearchParams(qs);
        const obj = {};
        for (const [k, v] of params) obj[k] = v;
        return obj;
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            ui.showToast('success', 'Copied', 'Copied to clipboard');
        } catch {
            ui.showToast('error', 'Failed', 'Could not copy');
        }
    },

    readImageFile(inputIdOrFile) {
        const file = typeof inputIdOrFile === 'string'
            ? document.getElementById(inputIdOrFile)?.files?.[0]
            : inputIdOrFile;
        if (!file) return Promise.resolve(null);
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 800 * 1024) {
            return Promise.reject(new Error('Choose a JPEG, PNG, or WebP image under 800 KB'));
        }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Could not read image'));
            reader.readAsDataURL(file);
        });
    },

    // Sleep
    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
};
