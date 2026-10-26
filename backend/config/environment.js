/**
 * Environment Detection
 * Determines if running on cloud server or local branch server.
 */
const ENV = {
    // App mode: "cloud" (central) or "local" (branch LAN)
    get mode() {
        return process.env.APP_MODE || 'cloud';
    },

    get isCloud() {
        return this.mode === 'cloud';
    },

    get isLocal() {
        return this.mode === 'local';
    },

    get isDevelopment() {
        return process.env.NODE_ENV === 'development';
    },

    get isProduction() {
        return process.env.NODE_ENV === 'production';
    },

    // Branch ID (only set when mode = "local")
    get branchId() {
        return process.env.BRANCH_ID || null;
    },

    // Node version check
    validate() {
        const nodeVersion = process.versions.node;
        const major = parseInt(nodeVersion.split('.')[0]);
        if (major < 18) {
            throw new Error(`Node.js 18+ required. Found v${nodeVersion}`);
        }
    }
};

module.exports = ENV;