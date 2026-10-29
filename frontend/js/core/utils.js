/**
 * Small utility functions used across pages.
 */
const utils = {
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

    // Sleep
    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
};