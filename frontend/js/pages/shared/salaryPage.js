class SalaryPage {
    constructor() { this.salaries = []; }

    async render(container) {
        if (auth.user?.role === 'employer' || auth.user?.activeRoles?.includes('accounting') || auth.user?.activeRoles?.includes('manager') || auth.user?.delegatedPermissions?.some(p => p.enabled && p.key === 'payroll.manage')) {
            return this.renderManager(container);
        }
        return this.renderEmployee(container);
    }

    async renderManager(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-money-bill-wave"></i> Salary Management</h3>
                    <button class="btn btn-primary" onclick="pageSalary.showGenerateModal()"><i class="fas fa-calculator"></i> Generate</button>
                </div>
                <div class="card-body"><div id="salary-table-container">${ui.loader()}</div></div>
            </div>`;
        await this.loadSalaries();
    }

    async loadSalaries() {
        try {
            const res = await salaryApi.list({ limit: 100 });
            this.salaries = res.salaries || [];
            this.renderManagerTable();
        } catch (err) { document.getElementById('salary-table-container').innerHTML = ui.errorState(err.message); }
    }

    renderManagerTable() {
        const c = document.getElementById('salary-table-container');
        if (!this.salaries.length) { c.innerHTML = ui.emptyState('No salaries', 'fa-file-invoice-dollar'); return; }
        const headers = [
            { key: 'employee', label: 'Employee', format: v => v ? `${v.firstName} ${v.lastName}` : '-' },
            { key: 'period', label: 'Period' },
            { key: 'netSalary', label: 'Net', format: v => ui.formatCurrency(v) },
            { key: 'payment', label: 'Status', format: v => ui.statusBadge(v?.status || 'pending') }
        ];
        const actions = [
            { icon: 'fa-eye', title: 'View', class: 'text-primary', handler: 'pageSalary.showSalaryDetail' },
            { icon: 'fa-check', title: 'Pay', class: 'text-success',
              condition: r => r.payment?.status === 'pending', handler: 'pageSalary.showPayModal' }
        ];
        c.innerHTML = ui.generateTable(headers, this.salaries, { actions });
    }

    async renderEmployee(container) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-money-bill-wave"></i> My Salary</h3>
                    <button class="btn btn-primary" onclick="pageSalary.showAdvanceModal()"><i class="fas fa-hand-holding-usd"></i> Request Advance</button>
                </div>
                <div class="card-body"><div id="my-salary">${ui.loader()}</div></div>
            </div>`;
        await this.loadMySalary();
    }

    async loadMySalary() {
        try {
            const res = await salaryApi.list({ limit: 50 });
            const list = res.salaries || [];
            const c = document.getElementById('my-salary');
            if (!list.length) { c.innerHTML = ui.emptyState('No salary records', 'fa-file-invoice-dollar'); return; }
            const headers = [
                { key: 'period', label: 'Period' },
                { key: 'baseSalary', label: 'Base', format: v => ui.formatCurrency(v) },
                { key: 'netSalary', label: 'Net', format: v => `<strong class="text-primary">${ui.formatCurrency(v)}</strong>` },
                { key: 'payment', label: 'Status', format: v => ui.statusBadge(v?.status || 'pending') }
            ];
            c.innerHTML = ui.generateTable(headers, list, {});
        } catch (err) { document.getElementById('my-salary').innerHTML = ui.errorState(err.message); }
    }

    showGenerateModal() {
        const now = new Date();
        ui.showModal('Generate Salaries', `
            <div class="form-group"><label>Month</label>
                <select id="gen-month">${Array.from({length:12},(_,i) => `<option value="${i+1}" ${i === now.getMonth() ? 'selected' : ''}>${new Date(2024,i,1).toLocaleString('default',{month:'long'})}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Year</label><input type="number" id="gen-year" value="${now.getFullYear()}"></div>
            `, `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageSalary.doGenerate()">Generate</button>`);
    }

    async doGenerate() {
        try {
            const res = await salaryApi.generate({
                month: parseInt(document.getElementById('gen-month').value),
                year: parseInt(document.getElementById('gen-year').value)
            });
            ui.closeModal();
            ui.showToast('success', 'Generated', `${res.generated || 0} records created`);
            this.loadSalaries();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    showSalaryDetail(index) {
        const s = this.salaries[index];
        if (!s) return;
        
        const attendance = s.attendanceSummary || {};
        const earnings = s.earnings || {};
        const deductions = s.deductions || [];
        const advances = s.advances || [];
        
        const deductionsHtml = deductions.map(d => `
            <tr><td>${d.type}</td><td>${d.description || '-'}</td><td class="text-danger">- ${ui.formatCurrency(d.amount)}</td></tr>
        `).join('') || '<tr><td colspan="3" class="text-muted">No deductions</td></tr>';
        
        const advancesHtml = advances.map(a => `
            <tr><td>${ui.formatDate(a.date)}</td><td>${a.reason || '-'}</td><td class="text-warning">- ${ui.formatCurrency(a.amount)}</td></tr>
        `).join('') || '<tr><td colspan="3" class="text-muted">No advances</td></tr>';
        
        const content = `
            <div class="grid-2 gap-3 mb-3">
                <div><p class="text-sm text-secondary">Employee</p>
                    <p class="font-bold">${s.employee?.firstName || ''} ${s.employee?.lastName || ''}</p></div>
                <div><p class="text-sm text-secondary">Period</p>
                    <p class="font-bold">${s.period}</p></div>
            </div>

            <h4 class="mt-3 mb-2">Attendance Summary</h4>
            <div class="grid-3 gap-2">
                <div class="p-2 rounded text-center" style="background:var(--success-light);">
                    <p class="text-xs">Present</p><p class="font-bold text-success">${attendance.presentDays || 0}</p>
                </div>
                <div class="p-2 rounded text-center" style="background:var(--danger-light);">
                    <p class="text-xs">Absent</p><p class="font-bold text-danger">${attendance.absentDays || 0}</p>
                </div>
                <div class="p-2 rounded text-center" style="background:var(--warning-light);">
                    <p class="text-xs">Late</p><p class="font-bold text-warning">${attendance.lateDays || 0}</p>
                </div>
            </div>

            <h4 class="mt-3 mb-2">Earnings</h4>
            <div class="table-container">
                <table>
                    <tr><td>Base Pay</td><td>${ui.formatCurrency(earnings.basePay || 0)}</td></tr>
                    <tr><td>Overtime</td><td>${ui.formatCurrency(earnings.overtimePay || 0)}</td></tr>
                    <tr><td>Bonus</td><td>${ui.formatCurrency(earnings.bonus || 0)}</td></tr>
                    <tr class="font-bold"><td>Total Earnings</td><td>${ui.formatCurrency(earnings.totalEarnings || 0)}</td></tr>
                </table>
            </div>

            <h4 class="mt-3 mb-2">Deductions</h4>
            <div class="table-container">
                <table>
                    <thead><tr><th>Type</th><th>Reason</th><th>Amount</th></tr></thead>
                    <tbody>${deductionsHtml}</tbody>
                </table>
            </div>

            <h4 class="mt-3 mb-2">Advances</h4>
            <div class="table-container">
                <table>
                    <thead><tr><th>Date</th><th>Reason</th><th>Amount</th></tr></thead>
                    <tbody>${advancesHtml}</tbody>
                </table>
            </div>

            <div class="mt-3 p-3 rounded" style="background:var(--bg-primary);">
                <div class="flex justify-between"><span class="font-bold">Total Deductions:</span>
                    <span class="font-bold text-danger">${ui.formatCurrency(s.totalDeductions || 0)}</span></div>
                <div class="flex justify-between"><span class="font-bold">Total Advances:</span>
                    <span class="font-bold text-warning">${ui.formatCurrency(s.totalAdvances || 0)}</span></div>
                <div class="flex justify-between mt-2 pt-2" style="border-top:1px solid var(--border-color);">
                    <span class="font-bold text-lg">NET SALARY:</span>
                    <span class="font-bold text-lg text-primary">${ui.formatCurrency(s.netSalary || 0)}</span></div>
            </div>
            ${auth.user.role === 'employer' || auth.user.activeRoles?.includes('manager') ? `<div class="flex gap-2 mt-3"><button class="btn btn-primary" onclick="pageSalary.showBonusModal('${s._id||s.id}')">Add Bonus</button>${auth.user.role==='employer'?`<button class="btn btn-warning" onclick="pageSalary.showDeductionModal('${s._id||s.id}')">Add Deduction</button>`:''}</div>`:''}
            ${auth.user.role==='employer' && s.bonusApproval?.status==='pending'?`<div class="flex gap-2 mt-2"><button class="btn btn-success" onclick="pageSalary.decideBonus('${s._id||s.id}',true)">Approve Bonus (${ui.formatCurrency(earnings.bonus||0)})</button><button class="btn btn-danger" onclick="pageSalary.decideBonus('${s._id||s.id}',false)">Reject Bonus</button></div>`:''}
        `;
        ui.showModal(`Salary — ${s.period}`, content);
    }

    showBonusModal(id) {
        ui.showModal('Add Bonus', `<div class="form-group"><label>Amount</label><input type="number" id="bonus-amount" min="0.01" step="0.01"></div><div class="form-group"><label>Reason</label><textarea id="bonus-reason" required></textarea></div>`, `<button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button><button class="btn btn-primary" onclick="pageSalary.addBonus('${id}')">Submit</button>`);
    }
    async addBonus(id) {
        try { await salaryApi.addBonus(id,{amount:Number(document.getElementById('bonus-amount').value),reason:document.getElementById('bonus-reason').value});ui.closeModal();ui.showToast('success','Saved',auth.user.role==='employer'?'Bonus added':'Bonus sent to employer for approval');await this.loadSalaries(); }
        catch(err){ui.showToast('error','Could not add bonus',err.message);}
    }
    async decideBonus(id,approved) {
        try { await salaryApi.approveBonus(id,{approved});ui.showToast('success',approved?'Approved':'Rejected','Bonus decision saved');ui.closeModal();await this.loadSalaries(); }
        catch(err){ui.showToast('error','Decision failed',err.message);}
    }
    showDeductionModal(id) {
        ui.showModal('Add Salary Deduction',`<div class="form-group"><label>Type</label><select id="deduction-type"><option value="absence">Absence</option><option value="late">Late</option><option value="advance">Advance</option><option value="loan">Loan</option><option value="tax">Tax</option><option value="pension">Pension</option><option value="insurance">Insurance</option><option value="other">Other</option></select></div><div class="form-group"><label>Amount</label><input id="deduction-amount" type="number" min="0.01" step="0.01"></div><div class="form-group"><label>Reason</label><textarea id="deduction-description" required></textarea></div>`,`<button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button><button class="btn btn-warning" onclick="pageSalary.addDeduction('${id}')">Save Deduction</button>`);
    }
    async addDeduction(id) {
        try { await salaryApi.addDeduction(id,{type:document.getElementById('deduction-type').value,amount:Number(document.getElementById('deduction-amount').value),description:document.getElementById('deduction-description').value});ui.closeModal();ui.showToast('success','Saved','Salary recalculated');await this.loadSalaries(); }
        catch(err){ui.showToast('error','Could not save deduction',err.message);}
    }

    showPayModal(index) {
        const s = this.salaries[index];
        if (!s) return;
        ui.showModal('Pay Salary', `
            <p>Pay ${ui.formatCurrency(s.netSalary)} to ${s.employee?.firstName}?</p>
            <button class="btn btn-success mt-3" onclick="pageSalary.doPay('${s._id || s.id}')">Confirm Payment</button>
        `);
    }

    async doPay(id) {
        try {
            await salaryApi.pay(id, { paymentMethod: 'bank_transfer' });
            ui.closeModal();
            ui.showToast('success', 'Paid', 'Salary marked as paid');
            this.loadSalaries();
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }

    showAdvanceModal() {
        ui.showModal('Request Advance', `
            <div class="form-group"><label>Amount</label><input type="number" id="adv-amt" min="1"></div>
            <div class="form-group"><label>Reason</label><textarea id="adv-reason"></textarea></div>
        `, `
            <button class="btn btn-secondary" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="pageSalary.doRequestAdvance()">Submit</button>`);
    }

    async doRequestAdvance() {
        try {
            await salaryApi.requestAdvance({
                amount: parseFloat(document.getElementById('adv-amt').value),
                reason: document.getElementById('adv-reason').value
            });
            ui.closeModal();
            ui.showToast('success', 'Submitted', 'Advance request submitted');
        } catch (err) { ui.showToast('error', 'Error', err.message); }
    }
}
const pageSalary = new SalaryPage();
