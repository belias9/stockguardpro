class EndOfDayPage {
    async render(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header"><h3><i class="fas fa-calendar-day"></i> End of Day Reports</h3></div>
                <div class="card-body">
                    <p class="text-muted">End of day reports are generated at 22:00 daily (or your configured time).</p>
                    <p class="text-muted mt-2">Reports include: goods bought, attendance, faulty goods, cashier totals, transfers, alerts.</p>
                    <div class="mt-4 p-3 rounded" style="background:var(--info-light);">
                        <p class="text-sm text-info"><i class="fas fa-info-circle"></i> Delivery: In-app + WhatsApp (if configured)</p>
                    </div>
                </div>
            </div>
        `;
    }
}

const pageEndOfDay = new EndOfDayPage();