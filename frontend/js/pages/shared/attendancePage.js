class AttendancePage {
    async render(container) {
        if (auth.user?.role === 'employer') {
            return this.renderEmployer(container);
        }
        return this.renderEmployee(container);
    }

    // ============ EMPLOYER VIEW ============
    async renderEmployer(container) {
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header"><h3><i class="fas fa-fingerprint"></i> Attendance Device</h3></div>
                <div class="card-body">
                    <div id="dev-status">${ui.loader()}</div>
                    <div class="mt-3">
                        <label>Assign attendance device to employee:</label>
                        <div class="flex gap-2 mt-2">
                            <select id="dev-employee" class="flex-1"></select>
                            <button class="btn btn-primary" onclick="pageAttendance.setDevice()"><i class="fas fa-fingerprint"></i> Set as Device</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card mb-4">
                <div class="card-header"><h3>Today's Attendance</h3></div>
                <div class="card-body"><div id="attendance-summary">${ui.loader()}</div></div>
            </div>`;
        await this.loadDeviceStatus();
        await this.loadEmployeesForDevice();
        await this.loadToday();
    }

    async loadDeviceStatus() {
        try {
            const res = await deviceApi.current();
            const el = document.getElementById('dev-status');
            if (res.device) {
                el.innerHTML = `<div class="p-3 rounded" style="background:var(--success-light);">
                    <p class="text-sm"><strong>Active:</strong> ${res.device.name}</p>
                    <p class="text-xs">Device ID: ${res.device.deviceId}</p>
                    <button class="btn btn-sm btn-danger mt-2" onclick="pageAttendance.deactivateDevice('${res.device.id}')">Deactivate</button>
                </div>`;
            } else {
                el.innerHTML = `<p class="text-muted">No device assigned. Select an employee below.</p>`;
            }
        } catch { document.getElementById('dev-status').innerHTML = '<p class="text-muted">No device</p>'; }
    }

    async loadEmployeesForDevice() {
        try {
            const res = await usersApi.list({ limit: 200 });
            const sel = document.getElementById('dev-employee');
            if (!sel) return;
            (res.users || []).filter(u => u.role === 'employee').forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = `${u.firstName} ${u.lastName} (${u.employeeId || 'no ID'})`;
                sel.appendChild(opt);
            });
        } catch {}
    }

    async setDevice() {
        const empId = document.getElementById('dev-employee').value;
        if (!empId) return;
        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/attendance/set-device`, {
                method: 'POST', headers: auth.getAuthHeaders(),
                body: JSON.stringify({ employeeId: empId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert(`Device set!\n\nAPI Key (save this — shown only once):\n${data.apiKey}`);
            this.loadDeviceStatus();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async deactivateDevice(id) {
        if (!confirm('Deactivate?')) return;
        try { await deviceApi.remove(id); this.loadDeviceStatus(); }
        catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    async loadToday() {
        try {
            const res = await attendanceApi.today();
            document.getElementById('attendance-summary').innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-icon success"><i class="fas fa-user-check"></i></div><div class="stat-content"><div class="stat-value">${res.present?.length || 0}</div><div class="stat-label">Present</div></div></div>
                    <div class="stat-card"><div class="stat-icon warning"><i class="fas fa-user-clock"></i></div><div class="stat-content"><div class="stat-value">${res.late?.length || 0}</div><div class="stat-label">Late</div></div></div>
                    <div class="stat-card"><div class="stat-icon danger"><i class="fas fa-user-times"></i></div><div class="stat-content"><div class="stat-value">${res.absent?.length || 0}</div><div class="stat-label">Absent</div></div></div>
                    <div class="stat-card"><div class="stat-icon info"><i class="fas fa-question-circle"></i></div><div class="stat-content"><div class="stat-value">${res.notYetClocked?.length || 0}</div><div class="stat-label">Not Clocked</div></div></div>
                </div>`;
        } catch (err) { document.getElementById('attendance-summary').innerHTML = ui.errorState(err.message); }
    }

    // ============ EMPLOYEE VIEW ============
    async renderEmployee(container) {
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header">
                    <h3><i class="fas fa-fingerprint"></i> My Attendance</h3>
                    <div class="flex gap-2">
                        <button class="btn btn-primary" onclick="pageAttendance.showClockInModal()"><i class="fas fa-fingerprint"></i> Clock In</button>
                        <button class="btn btn-success" onclick="pageAttendance.showClockOutModal()"><i class="fas fa-sign-out-alt"></i> Clock Out</button>
                    </div>
                </div>
                <div class="card-body"><div id="emp-att-summary">${ui.loader()}</div></div>
            </div>`;
        await this.loadEmployeeAttendance();
    }

    async loadEmployeeAttendance() {
        try {
            const now = new Date();
            const res = await attendanceApi.employee(auth.user._id, { month: now.getMonth() + 1, year: now.getFullYear() });
            const s = res.summary || {};
            document.getElementById('emp-att-summary').innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-icon success"><i class="fas fa-check"></i></div><div class="stat-content"><div class="stat-value">${s.present || 0}</div><div class="stat-label">Present Days</div></div></div>
                    <div class="stat-card"><div class="stat-icon danger"><i class="fas fa-times"></i></div><div class="stat-content"><div class="stat-value">${s.absent || 0}</div><div class="stat-label">Absent Days</div></div></div>
                    <div class="stat-card"><div class="stat-icon warning"><i class="fas fa-clock"></i></div><div class="stat-content"><div class="stat-value">${s.late || 0}</div><div class="stat-label">Late Days</div></div></div>
                    <div class="stat-card"><div class="stat-icon info"><i class="fas fa-hourglass"></i></div><div class="stat-content"><div class="stat-value">${(s.totalWorkingHours || 0).toFixed(1)}</div><div class="stat-label">Total Hours</div></div></div>
                </div>`;
        } catch (err) { document.getElementById('emp-att-summary').innerHTML = ui.errorState(err.message); }
    }

    showClockInModal() {
        ui.showModal('Clock In', `
            <div class="text-center p-4">
                <i class="fas fa-fingerprint fa-5x text-primary mb-3"></i>
                <p>Place finger on the attendance device</p>
                <button class="btn btn-primary mt-3" onclick="pageAttendance.doClockIn()">Verify & Clock In</button>
            </div>`, '');
    }

    async doClockIn() {
        try {
            await attendanceApi.clockIn({
                employeeId: auth.user._id,
                companyId: auth.user.company,
                fingerprintVerified: true,
                deviceId: 'WEB_' + Date.now(),
                method: 'fingerprint'
            });
            ui.closeModal();
            ui.showToast('success', 'Clocked In', 'Attendance recorded');
            this.loadEmployeeAttendance();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    showClockOutModal() {
        ui.showModal('Clock Out', `
            <div class="text-center p-4">
                <i class="fas fa-fingerprint fa-5x text-success mb-3"></i>
                <p>Place finger on the attendance device</p>
                <button class="btn btn-success mt-3" onclick="pageAttendance.doClockOut()">Verify & Clock Out</button>
            </div>`, '');
    }

    async doClockOut() {
        try {
            await attendanceApi.clockOut({
                employeeId: auth.user._id,
                companyId: auth.user.company,
                fingerprintVerified: true,
                deviceId: 'WEB_' + Date.now(),
                method: 'fingerprint'
            });
            ui.closeModal();
            ui.showToast('success', 'Clocked Out', 'Attendance recorded');
            this.loadEmployeeAttendance();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
}
const pageAttendance = new AttendancePage();
