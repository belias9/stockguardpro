class DashboardPage {
    async render(container) {
        if (auth.user?.role === 'employer') return this.renderEmployer(container);
        return this.renderEmployee(container);
    }

    async renderEmployer(container) {
        container.innerHTML = ui.loader();
        try {
            const res = await dashboardApi.overview();
            const d = res.overview;
            container.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon primary"><i class="fas fa-boxes"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${d.inventory.totalItems}</div>
                            <div class="stat-label">Inventory Items</div>
                            <div class="stat-change">${d.inventory.lowStock} low stock</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon warning"><i class="fas fa-dolly"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${d.withdrawals.pending}</div>
                            <div class="stat-label">Pending Withdrawals</div>
                            <div class="stat-change">${d.withdrawals.today} today</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon success"><i class="fas fa-users"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${d.attendance.presentToday}</div>
                            <div class="stat-label">Present Today</div>
                            <div class="stat-change">${d.attendance.attendanceRate}% rate</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon info"><i class="fas fa-money-bill-wave"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${d.salary.pendingPayments}</div>
                            <div class="stat-label">Pending Salaries</div>
                            <div class="stat-change">${d.salary.disputed} disputed</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon danger"><i class="fas fa-envelope"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${d.communication.unreadMessages}</div>
                            <div class="stat-label">Unread Messages</div>
                            <div class="stat-change">${d.communication.pendingComplaints} complaints</div>
                        </div>
                    </div>
                </div>
                <div class="grid-2 mt-4">
                    <div class="card">
                        <div class="card-header"><h3><i class="fas fa-bolt"></i> Quick Actions</h3></div>
                        <div class="card-body">
                            <div class="grid-2 gap-3">
                                <button class="btn btn-primary" onclick="router.navigate('inventory')"><i class="fas fa-plus"></i> Add Inventory</button>
                                <button class="btn btn-success" onclick="router.navigate('receipts')"><i class="fas fa-receipt"></i> New Receipt</button>
                                <button class="btn btn-info" onclick="router.navigate('withdrawals')"><i class="fas fa-dolly"></i> Withdrawals</button>
                                <button class="btn btn-warning" onclick="router.navigate('attendance')"><i class="fas fa-fingerprint"></i> Attendance</button>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h3><i class="fas fa-bell"></i> Alerts</h3></div>
                        <div class="card-body">
                            <p class="text-sm text-muted"><i class="fas fa-check-circle text-success"></i> All systems operational.</p>
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            container.innerHTML = ui.errorState(err.message);
        }
    }

    async renderEmployee(container) {
        container.innerHTML = ui.loader();
        try {
            const data = await dashboardApi.employeeDash();
            container.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon primary"><i class="fas fa-fingerprint"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${data.todayAttendance?.status === 'present' ? '✓' : '✗'}</div>
                            <div class="stat-label">Today's Attendance</div>
                            <div class="stat-change">${data.todayAttendance?.status || 'not_clocked'}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon success"><i class="fas fa-clock"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${data.attendanceSummary.totalHours.toFixed(1)}</div>
                            <div class="stat-label">Hours This Month</div>
                            <div class="stat-change">${data.attendanceSummary.present} present days</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon info"><i class="fas fa-money-bill-wave"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${data.currentSalary ? ui.formatCurrency(data.currentSalary.netSalary) : 'N/A'}</div>
                            <div class="stat-label">Net Salary</div>
                            <div class="stat-change">${data.currentSalary ? data.currentSalary.payment.status : 'Not generated'}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon warning"><i class="fas fa-envelope"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${data.unreadMessages}</div>
                            <div class="stat-label">Unread Messages</div>
                            <div class="stat-change">${data.pendingAdvances} pending advances</div>
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            container.innerHTML = ui.errorState(err.message);
        }
    }
}

const pageDashboard = new DashboardPage();