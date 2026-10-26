class UIManager {
    _ensure() {
        this.toastContainer = this.toastContainer || document.getElementById('toast-container');
        this.modalContainer = this.modalContainer || document.getElementById('modal-container');
        this.modalContent = this.modalContent || document.getElementById('modal-content');
    }

    showToast(type, title, message, duration = 4000) {
        this._ensure();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
        `;
        this.toastContainer.appendChild(toast);
        setTimeout(() => { if (toast.parentElement) toast.remove(); }, duration);
    }

    showModal(title, content, footer = '') {
        this._ensure();
        this.modalContent.innerHTML = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="ui.closeModal()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">${content}</div>
            ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        `;
        this.modalContainer.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this._ensure();
        this.modalContainer.classList.add('hidden');
        document.body.style.overflow = '';
    }

    confirm(title, message, onConfirm) {
        const content = `<p>${message}</p>`;
        const footer = `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-danger" id="confirm-btn">Confirm</button>
        `;
        this.showModal(title, content, footer);
        document.getElementById('confirm-btn').addEventListener('click', () => {
            this.closeModal();
            onConfirm();
        });
    }

    formatCurrency(amount, currency = 'XAF ') {
        if (amount === null || amount === undefined) return '-';
        return `${currency}${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    formatDate(d, format = 'short') {
        if (!d) return '-';
        const date = new Date(d);
        if (format === 'short') return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        if (format === 'long') return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        if (format === 'time') return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString('en-GB');
    }

    statusBadge(status) {
        const map = {
            pending: { c: 'pending', l: 'Pending' },
            approved: { c: 'approved', l: 'Approved' },
            rejected: { c: 'rejected', l: 'Rejected' },
            completed: { c: 'completed', l: 'Completed' },
            cancelled: { c: 'rejected', l: 'Cancelled' },
            present: { c: 'present', l: 'Present' },
            absent: { c: 'absent', l: 'Absent' },
            late: { c: 'late', l: 'Late' },
            paid: { c: 'paid', l: 'Paid' },
            draft: { c: 'pending', l: 'Draft' },
            finalized: { c: 'completed', l: 'Finalized' }
        };
        const m = map[status] || { c: 'pending', l: status };
        return `<span class="status-badge ${m.c}">${m.l}</span>`;
    }

    loader() {
        return `<div class="text-center p-5"><div class="loading-spinner"></div><p class="text-muted mt-3">Loading...</p></div>`;
    }

    errorState(msg) {
        return `<div class="text-center p-5"><i class="fas fa-exclamation-circle fa-3x text-danger mb-3"></i><p class="text-danger">${msg}</p></div>`;
    }

    emptyState(msg, icon = 'fa-inbox') {
        return `<div class="text-center p-5"><i class="fas ${icon} fa-3x text-muted mb-3"></i><p class="text-muted">${msg}</p></div>`;
    }

    generateTable(headers, rows, options = {}) {
        const { actions = [], emptyMessage = 'No data' } = options;
        if (!rows || rows.length === 0) return `<div class="text-center p-5 text-muted">${emptyMessage}</div>`;
        let html = `<div class="table-container"><table><thead><tr>`;
        headers.forEach(h => html += `<th>${h.label}</th>`);
        if (actions.length > 0) html += '<th>Actions</th>';
        html += '</tr></thead><tbody>';
        rows.forEach((row, i) => {
            html += '<tr>';
            headers.forEach(h => {
                const v = h.format ? h.format(row[h.key], row) : (row[h.key] ?? '-');
                html += `<td>${v}</td>`;
            });
            if (actions.length > 0) {
                html += '<td><div class="flex gap-1">';
                actions.forEach(a => {
                    if (a.condition && !a.condition(row)) return;
                    html += `<button class="btn btn-icon ${a.class || ''}" onclick="${a.handler}(${i})" title="${a.title}"><i class="fas ${a.icon}"></i></button>`;
                });
                html += '</div></td>';
            }
            html += '</tr>';
        });
        return html + '</tbody></table></div>';
    }

    renderSidebar(menu) {
        const html = menu.map(section => `
            <div class="nav-section">
                <p class="nav-label">${section.label}</p>
                ${section.items.map(item => `
                    <a href="#${item.page}" class="nav-link" data-page="${item.page}">
                        <i class="fas ${item.icon}"></i>
                        <span>${item.label}</span>
                    </a>
                `).join('')}
            </div>
        `).join('');
        const slot = document.getElementById('sidebar-menu');
        if (slot) slot.innerHTML = html;
    }

    toggleSidebar() {
        const sb = document.getElementById('sidebar');
        if (!sb) return;
        sb.classList.toggle('collapsed');
        localStorage.setItem('sidebar_collapsed', sb.classList.contains('collapsed'));
    }

    initSidebar() {
        const sb = document.getElementById('sidebar');
        if (sb && localStorage.getItem('sidebar_collapsed') === 'true') sb.classList.add('collapsed');
    }
}

const ui = new UIManager();

document.addEventListener('click', (e) => { if (e.target.classList.contains('modal-overlay')) ui.closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ui.closeModal(); });