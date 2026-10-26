class AttendancePage {
    async render(container) {
        container.innerHTML = ui.loader();
        try {
            const res = await attendanceApi.today();
            container.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon success"><i class="fas fa-user-check"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${res.present?.length || 0}</div>
                            <div class="stat-label">Present</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon warning"><i class="fas fa-user-clock"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${res.late?.length || 0}</div>
                            <div class="stat-label">Late</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon danger"><i class="fas fa-user-times"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${res.absent?.length || 0}</div>
                            <div class="stat-label">Absent</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon info"><i class="fas fa-question-circle"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${res.notYetClocked?.length || 0}</div>
                            <div class="stat-label">Not Clocked</div>
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            container.innerHTML = ui.errorState(err.message);
        }
    }
}

const pageAttendance = new AttendancePage();