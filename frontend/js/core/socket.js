let socket = null;

function initSocket() {
    if (!auth.token || !auth.company) return;
    try {
        socket = io(CONFIG.SOCKET_URL, { auth: { token: auth.token } });

        socket.on('connect', () => console.log('[Socket] Connected'));
        socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

        socket.on('withdrawal:created', (d) => ui.showToast('info', 'New Withdrawal', d.withdrawalId));
        socket.on('withdrawal:approved', (d) => ui.showToast('success', 'Approved', d.withdrawalId));
        socket.on('withdrawal:dispatched', (d) => ui.showToast('info', 'Dispatched', d.withdrawalId));
        socket.on('payment:confirmed', (d) => ui.showToast('success', 'Payment Confirmed', d.receiptId));
        socket.on('message:new', (d) => ui.showToast('info', 'New Message', d.subject));
    } catch (err) {
        console.error('[Socket] Init failed:', err);
    }
}