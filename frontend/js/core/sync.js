/**
 * Frontend Sync Status
 * Polls server for offline/online + queue status.
 */
const syncManager = {
    status: { online: true, mode: 'cloud', stats: { pending: 0, failed: 0 } },

    async fetchStatus() {
        try {
            const res = await api.get('/sync/status');
            this.status = res;
            this.updateUI();
        } catch (err) {
            this.status.online = false;
            this.updateUI();
        }
    },

    updateUI() {
        const badge = document.getElementById('sync-badge');
        if (!badge) return;

        if (this.status.mode !== 'local') {
            badge.classList.add('hidden');
            return;
        }

        badge.classList.remove('hidden');
        if (!this.status.online) {
            badge.className = 'sync-badge offline';
            badge.innerHTML = '<i class="fas fa-wifi"></i> Offline';
        } else if (this.status.stats?.pending > 0) {
            badge.className = 'sync-badge pending';
            badge.innerHTML = `<i class="fas fa-sync"></i> ${this.status.stats.pending} pending`;
        } else {
            badge.className = 'sync-badge online';
            badge.innerHTML = '<i class="fas fa-check-circle"></i> Synced';
        }
    },

    start() {
        if (this._interval) return;
        this.fetchStatus();
        this._interval = setInterval(() => this.fetchStatus(), 30000);
    },

    stop() {
        if (this._interval) clearInterval(this._interval);
        this._interval = null;
    }
};