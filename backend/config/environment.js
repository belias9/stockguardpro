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
        if (this.isProduction) {
            for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
                if (!process.env[key] || process.env[key].length < 32) throw new Error(`${key} must be set to a unique secret of at least 32 characters in production`);
            }
            if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
            if (!process.env.MONGODB_URI && this.isCloud) throw new Error('MONGODB_URI is required in production cloud mode');
            if (process.env.APP_MODE === 'local' && process.env.CLOUD_API_URL && (!process.env.SYNC_SECRET || process.env.SYNC_SECRET.length < 32)) {
                throw new Error('SYNC_SECRET of at least 32 characters is required for local-to-cloud synchronization');
            }
        }
    }
};

module.exports = ENV;
