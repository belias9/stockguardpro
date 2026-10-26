class MessagesPage {
    async render(container) {
        container.innerHTML = ui.loader();
        try {
            const res = await communicationApi.inbox();
            const headers = [
                { key: 'subject', label: 'Subject' },
                { key: 'senderName', label: 'From' },
                { key: 'status', label: 'Status', format: v => ui.statusBadge(v) },
                { key: 'createdAt', label: 'Date', format: v => ui.formatDate(v) }
            ];
            container.innerHTML = `<div class="card"><div class="card-header"><h3><i class="fas fa-envelope"></i> Inbox</h3></div><div class="card-body">${ui.generateTable(headers, res.messages, { emptyMessage: 'No messages' })}</div></div>`;
        } catch (err) {
            container.innerHTML = ui.errorState(err.message);
        }
    }
}

const pageMessages = new MessagesPage();