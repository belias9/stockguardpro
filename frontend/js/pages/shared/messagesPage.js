class MessagesPage {
    constructor() { this.messages = []; this.tab = 'inbox'; }

    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-envelope"></i> Messages</h3>
                    <button class="btn btn-primary" onclick="pageMessages.showCompose()"><i class="fas fa-pen"></i> New Message</button>
                </div>
                <div class="card-body">
                    <div class="flex gap-2 mb-3 border-bottom pb-2">
                        <button class="btn btn-text ${this.tab === 'inbox' ? 'text-primary font-bold' : ''}" onclick="pageMessages.switchTab('inbox')">
                            <i class="fas fa-inbox"></i> Inbox <span id="unread-badge" class="badge">0</span>
                        </button>
                        <button class="btn btn-text ${this.tab === 'sent' ? 'text-primary font-bold' : ''}" onclick="pageMessages.switchTab('sent')">
                            <i class="fas fa-paper-plane"></i> Sent
                        </button>
                    </div>
                    <div id="msg-table">${ui.loader()}</div>
                </div>
            </div>`;
        await this.load();
    }

    async load() {
        try {
            const res = this.tab === 'inbox' ? await communicationApi.inbox({ limit: 50 }) : await communicationApi.sent({ limit: 50 });
            this.messages = res.messages || [];
            const badge = document.getElementById('unread-badge');
            if (badge) { badge.textContent = res.unreadCount || 0; badge.style.display = (res.unreadCount > 0) ? 'inline' : 'none'; }
            this.renderTable();
        } catch (err) { document.getElementById('msg-table').innerHTML = ui.errorState(err.message); }
    }

    renderTable() {
        const c = document.getElementById('msg-table');
        if (!this.messages.length) { c.innerHTML = ui.emptyState('No messages', 'fa-envelope-open'); return; }
        const headers = [
            { key: 'subject', label: 'Subject', format: (v, r) => `${r.status === 'unread' && this.tab === 'inbox' ? '● ' : ''}${v}` },
            { key: 'type', label: 'Type', format: v => v.replace('_', ' ') },
            { key: this.tab === 'inbox' ? 'senderName' : 'recipientName', label: this.tab === 'inbox' ? 'From' : 'To' },
            { key: 'status', label: 'Status', format: v => ui.statusBadge(v) },
            { key: 'createdAt', label: 'Date', format: v => ui.formatDate(v) }
        ];
        const actions = [
            { icon: 'fa-eye', title: 'View', class: 'text-primary', handler: 'pageMessages.showDetail' }
        ];
        c.innerHTML = ui.generateTable(headers, this.messages, { actions });
    }

    switchTab(tab) { this.tab = tab; this.render(document.getElementById('page-content')); }

    async showCompose() {
        try {
            const rec = await communicationApi.recipients();
            const recipients = rec.recipients || [];
            const content = `
                <div class="form-group"><label>To *</label>
                    <select id="msg-to" required>
                        <option value="">Select recipient</option>
                        ${recipients.map(r => `<option value="${r._id || r.id}">${r.firstName} ${r.lastName} (${r.role})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Type *</label>
                    <select id="msg-type" required>
                        <option value="general">General</option>
                        <option value="complaint">Complaint</option>
                        <option value="request">Request</option>
                        <option value="urgent">Urgent</option>
                        <option value="feedback">Feedback</option>
                    </select>
                </div>
                <div class="form-group"><label>Subject *</label><input type="text" id="msg-subj" required></div>
                <div class="form-group"><label>Priority</label>
                    <select id="msg-prio">
                        <option value="low">Low</option><option value="normal" selected>Normal</option>
                        <option value="high">High</option><option value="urgent">Urgent</option>
                    </select>
                </div>
                <div class="form-group"><label>Message *</label><textarea id="msg-body" rows="5" required></textarea></div>`;
            const footer = `
                <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="pageMessages.send()"><i class="fas fa-paper-plane"></i> Send</button>`;
            ui.showModal('New Message', content, footer);
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async send() {
        const recipientId = document.getElementById('msg-to').value;
        const subject = document.getElementById('msg-subj').value;
        const message = document.getElementById('msg-body').value;
        if (!recipientId || !subject || !message) { ui.showToast('warning', 'Validation', 'Fill required fields'); return; }
        try {
            await communicationApi.send({
                recipientId,
                type: document.getElementById('msg-type').value,
                subject,
                message,
                priority: document.getElementById('msg-prio').value
            });
            ui.closeModal(); ui.showToast('success', 'Sent', 'Message sent'); this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async showDetail(index) {
        const m = this.messages[index];
        if (!m) return;
        try {
            const res = await communicationApi.get(m._id || m.id);
            const msg = res.message;
            const responses = (msg.responses || []).map(r => `
                <div class="p-2 mb-1 rounded" style="background:var(--primary-light);">
                    <p class="text-xs font-bold">${r.responderName} <span class="text-muted">(${ui.formatDate(r.timestamp, 'long')})</span></p>
                    <p class="text-sm">${r.message}</p>
                </div>`).join('') || '<p class="text-muted text-sm">No responses yet</p>';
            const content = `
                <div class="mb-3">
                    <p class="text-sm"><strong>From:</strong> ${msg.senderName}</p>
                    <p class="text-sm"><strong>To:</strong> ${msg.recipientName}</p>
                    <p class="text-sm"><strong>Subject:</strong> ${msg.subject}</p>
                    <p class="text-sm"><strong>Date:</strong> ${ui.formatDate(msg.createdAt, 'long')}</p>
                </div>
                <div class="p-3 rounded mb-3" style="background:var(--bg-primary);">
                    <p>${msg.message}</p>
                </div>
                <h4 class="mb-2">Responses</h4>
                ${responses}
                <div class="mt-3">
                    <textarea id="reply-text" rows="3" placeholder="Type your response..." class="w-full"></textarea>
                    <button class="btn btn-primary mt-2" onclick="pageMessages.reply('${msg._id || msg.id}')"><i class="fas fa-reply"></i> Send Reply</button>
                </div>`;
            ui.showModal(msg.subject, content);
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async reply(id) {
        const text = document.getElementById('reply-text').value;
        if (!text.trim()) { ui.showToast('warning', 'Validation', 'Enter a response'); return; }
        try {
            await communicationApi.respond(id, { message: text });
            ui.closeModal(); ui.showToast('success', 'Sent', 'Reply sent'); this.load();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
}
const pageMessages = new MessagesPage();
