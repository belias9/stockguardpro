class SalaryPage {
    async render(container) {
        container.innerHTML = ui.loader();
        try {
            const res = await salaryApi.list({ page: 1, limit: 20 });
            const headers = [
                { key: 'employee', label: 'Employee', format: v => v ? `${v.firstName} ${v.lastName}` : '-' },
                { key: 'period', label: 'Period' },
                { key: 'netSalary', label: 'Net Salary', format: v => ui.formatCurrency(v) },
                { key: 'payment', label: 'Status', format: v => ui.statusBadge(v?.status || 'pending') }
            ];
            container.innerHTML = `<div class="card"><div class="card-header"><h3><i class="fas fa-money-bill-wave"></i> Salaries</h3></div><div class="card-body">${ui.generateTable(headers, res.salaries, { emptyMessage: 'No salaries' })}</div></div>`;
        } catch (err) {
            container.innerHTML = ui.errorState(err.message);
        }
    }
}

const pageSalary = new SalaryPage();