const tutorialWorkflows = {
    employer: {
        label: 'Employer',
        intro: 'Set up the company, delegate work, monitor branches and review financial activity.',
        slides: [
            { title: 'Start with company setup', page: 'settings', action: 'Open Settings', steps: ['Open Settings and enter company details, contact information and receipt preferences.', 'Upload a company logo or use the logo generator.', 'Add company policies and certificates. Make policies employees must acknowledge available before they continue.', 'Set attendance rules and choose the company end of day report sections.'] },
            { title: 'Create the company structure', page: 'branch-detail', action: 'Open Branches & Warehouses', steps: ['Create each branch and its warehouses.', 'Set the correct branch as the employee’s home branch when creating their account.', 'Add inventory to the correct warehouse so sales and transfers affect the right stock.'] },
            { title: 'Create people and assign access', page: 'users', action: 'Open Users & Roles', steps: ['Create a user with their name, contact details, branch and login credentials.', 'Assign only the roles needed for their work.', 'Use Task Permissions for exceptional tasks and set an approver where the task needs supervision.', 'Review delegated employer scopes separately from employee roles.'] },
            { title: 'Follow stock from receipt to dispatch', page: 'inventory', action: 'Open Inventory', steps: ['Review inventory and low stock by branch and warehouse.', 'Have stock staff enter confirmed purchases or request transfers.', 'Review pending approvals before stock is received, moved or dispatched.', 'Use Receipts and Withdrawals to investigate what left stock and why.'] },
            { title: 'Review sales, customers and branch cash', page: 'receipts', action: 'Open Receipts', steps: ['Open a receipt to verify items, quantities, payment and confirmation status.', 'Open Customers to review a customer’s receipts and credit activity.', 'Use Accounting for branch expenses, customer credit and company level accounting.', 'Company loans are visible only to employers or people you explicitly authorize.'] },
            { title: 'Close and compare the day', page: 'end-of-day', action: 'Open End of Day', steps: ['Choose the branch and business date.', 'Review each report section enabled in company settings, then open the complete report for the combined view.', 'Download the sections or complete report for your records.', 'Compare sales, payments, stock movements and expenses; investigate differences before close.'] },
            { title: 'Use reports, audit and AI carefully', page: 'ai', action: 'Open AI Assistant', steps: ['Use Reports and Audit Trail to review recorded activity and who performed it.', 'Ask the AI assistant to summarize company data or provide a forecast when the data and AI integration are available.', 'Treat AI findings as decision support and verify important totals in the underlying records.', 'Set up external email, WhatsApp, payment and backup integrations using the integration guide.'] }
        ]
    },
    co_employer: {
        label: 'Co-employer',
        intro: 'Your access is limited to the company areas delegated by the primary employer.',
        slides: [
            { title: 'Check your assigned scope', page: 'dashboard', action: 'Open Dashboard', steps: ['Use the navigation menu as the list of areas currently available to you.', 'If a company page is missing, ask the primary employer to delegate its scope.', 'Do not share your login. Your actions are recorded under your account.'] },
            { title: 'Work within your granted areas', page: 'accounting', action: 'Open Accounting', steps: ['Use only the financial, people, operations or administration pages shown for your account.', 'Company-wide loans and sensitive records require specific authorization.', 'Follow the same review and approval steps as the primary employer for the work delegated to you.'] },
            { title: 'Review branches and activity', page: 'end-of-day', action: 'Open End of Day', steps: ['Select only branches within your authorized scope.', 'Review permitted reports and use the audit trail where available.', 'Ask the primary employer to adjust your access when responsibilities change.'] }
        ]
    },
    manager: {
        label: 'Manager',
        intro: 'Run your assigned branch, review requests and close the day using the reports enabled by the employer.',
        slides: [
            { title: 'Check your branch at opening', page: 'dashboard', action: 'Open Dashboard', steps: ['Confirm you are viewing the correct branch.', 'Review pending approvals, low stock, sales and attendance alerts.', 'Use Branch Inventory to compare expected stock with what is on hand.'] },
            { title: 'Review approvals before stock moves', page: 'manager-approvals', action: 'Open Approvals', steps: ['Open pending purchase, transfer, adjustment or expense requests.', 'Check the item, quantity, source and destination, supporting image or receipt, and requester.', 'Approve only when the details match the evidence; reject with a clear reason when they do not.', 'Confirm physical receipt or dispatch in the relevant stock workflow.'] },
            { title: 'Supervise sales and payment confirmation', page: 'receipts', action: 'Open Branch Receipts', steps: ['Check each receipt has the correct customer, items, quantities and payment type.', 'Use Confirm Payments for payments that need manager confirmation.', 'Create or review receipts according to your assigned access.', 'Customer credit or expenses must follow the company’s approval limits.'] },
            { title: 'Watch attendance and branch operations', page: 'attendance', action: 'Open Attendance', steps: ['Review attendance events and exceptions for your branch.', 'Flag missing or incorrect punches for correction through the employer’s process.', 'Do not change salary rules unless the employer has granted that access.'] },
            { title: 'Finish the branch day', page: 'end-of-day', action: 'Open Branch End of Day', steps: ['Choose your branch and the correct business date.', 'Review the sections enabled by the employer and download the report if needed.', 'Compare payment totals, receipts, expenses and stock movements.', 'Send unresolved differences to the employer before treating the close as complete.'] }
        ]
    },
    cashier: {
        label: 'Cashier',
        intro: 'Record customer payments and authorized branch customer credit or expenses. Company loans stay restricted unless explicitly authorized.',
        slides: [
            { title: 'Prepare to take payment', page: 'cashier', action: 'Open Payments', steps: ['Check the selected branch and customer before recording money.', 'Open the sale or receipt and confirm the amount due.', 'Keep cash, transfer, card or mobile money evidence according to company procedure.'] },
            { title: 'Record and confirm payment', page: 'cashier', action: 'Open Payments', steps: ['Choose the correct receipt and payment method.', 'Enter the amount actually received and any payment reference.', 'Confirm the payment only after checking the evidence.', 'If the amount or receipt is wrong, stop and ask a manager rather than inventing a correction.'] },
            { title: 'Handle customer credit and branch expenses', page: 'accounting', action: 'Open Customer Credit & Branch Expenses', steps: ['Open Accounting and use the customer credit area only for an identified customer and approved limit.', 'Record branch expenses with a description, amount and supporting evidence.', 'Submit expenses for approval when required; do not approve your own request.', 'Company loans and company-wide finance are not part of cashier access unless the employer authorizes it.'] },
            { title: 'End your shift cleanly', page: 'cashier', action: 'Open Payments', steps: ['Compare your recorded payments with cash and payment-provider evidence.', 'Tell the manager about any shortage, overage, failed transfer or unconfirmed payment.', 'Do not leave a payment marked confirmed when it has not cleared.'] }
        ]
    },
    sales: {
        label: 'Sales',
        intro: 'Check item availability, create accurate customer receipts and hand payment confirmation to the authorized person.',
        slides: [
            { title: 'Check items before promising a sale', page: 'browse-inventory', action: 'Browse Items', steps: ['Search the item and check the available quantity for your branch.', 'Confirm the price and product description with the current company record.', 'Ask a manager before promising unavailable stock or an unapproved discount.'] },
            { title: 'Create the receipt', page: 'sales', action: 'Open My Sales', steps: ['Select the customer or record the walk-in sale according to company procedure.', 'Add each item and verify its quantity, unit price and line total.', 'Review the receipt total and payment method before saving.', 'Use the camera or attach product evidence if the workflow requests it.'] },
            { title: 'Complete the handoff', page: 'sales', action: 'Open My Sales', steps: ['Give or send the customer their receipt using the available print or share action.', 'Have the cashier or authorized manager confirm payment when required.', 'Do not dispatch goods until the payment and stock handoff follow company rules.'] },
            { title: 'Check customer history', page: 'customers', action: 'Open Customers (if authorized)', steps: ['Use customer history to confirm prior receipts and permitted credit.', 'Some customer receipts or credit details may be hidden by employer limits.', 'Ask a manager to review access or correct customer details when needed.'] }
        ]
    },
    shop_buyer: {
        label: 'Shop Buyer',
        intro: 'Document purchases and send evidence for confirmation so received goods can be added to stock correctly.',
        slides: [
            { title: 'Prepare a purchase record', page: 'shop-buyer', action: 'Open Purchases', steps: ['Create a purchase or pre-record with supplier, date and branch.', 'Enter product names, quantities, unit costs and totals from the supplier document.', 'Use the camera or upload a clear image of the receipt. Check that dates and amounts are readable.'] },
            { title: 'Submit it for review', page: 'shop-buyer', action: 'Open Purchases', steps: ['Save and submit the record for the manager or employer to confirm.', 'Do not mark goods as received if they have not physically arrived.', 'If an item is new, include a clear product image and enough description to identify it.'] },
            { title: 'Verify stock after confirmation', page: 'browse-inventory', action: 'Browse Items', steps: ['After approval and receipt confirmation, check the item appears in the correct branch or warehouse.', 'Report duplicate items, wrong units or quantity differences to the manager.', 'Keep the original supplier evidence according to company policy.'] }
        ]
    },
    stock: {
        label: 'Stock Staff',
        intro: 'Record incoming stock and controlled movements. Stock should change only after the required confirmation.',
        slides: [
            { title: 'Check the location and item', page: 'browse-inventory', action: 'Browse Items', steps: ['Confirm the branch and warehouse before you start.', 'Search the item and check its current quantity and unit.', 'Tell the manager if the item is missing, duplicated or has a different unit.'] },
            { title: 'Enter incoming goods', page: 'stock-ops', action: 'Open Enter & Stock Operations', steps: ['Open the incoming or purchase record and match it to supplier evidence.', 'For a pre-record, compare the delivered goods with the saved request.', 'Attach an image for a new product when available and enter actual quantities received.', 'Submit for manager or employer confirmation if required.'] },
            { title: 'Request and confirm a transfer', page: 'withdrawals', action: 'Open Outing & Transfers', steps: ['Create a transfer request with source, destination, item and quantity.', 'Wait for the required approval before moving stock.', 'Record who collected or dispatched the goods and confirm destination receipt.', 'Report shortages or damage instead of confirming the requested quantity blindly.'] },
            { title: 'Keep an accurate movement trail', page: 'inventory', action: 'Open Inventory (if authorized)', steps: ['Check that confirmed movements updated the correct warehouse balance.', 'Do not use informal stock adjustments to hide missing goods.', 'Provide supporting notes and evidence so the manager can investigate differences.'] }
        ]
    },
    main_stock: {
        label: 'Main Stock',
        intro: 'Receive and validate central stock records, then document authorized dispatches to branches or collectors.',
        slides: [
            { title: 'Review incoming pre-records', page: 'stock-ops', action: 'Open Enter & Stock Operations', steps: ['Open the pre-record queue and match each delivery to its purchase evidence.', 'Check item identity, units and actual delivered quantity.', 'Attach a clear image for a product that does not already exist.', 'Enter missing details manually only when evidence supports them, then submit for manager or employer confirmation.'] },
            { title: 'Record received stock accurately', page: 'stock-ops', action: 'Open Enter & Stock Operations', steps: ['Confirm physical receipt before posting stock in.', 'Record partial deliveries as the quantity actually received and leave the remainder unresolved.', 'Verify the confirmed stock appears at the main warehouse.'] },
            { title: 'Dispatch only approved stock', page: 'withdrawals', action: 'Open Outing & Transfers', steps: ['Check the request is approved and the items are available.', 'Record the destination branch, quantities, dispatch date and collector name or ID.', 'Confirm goods handed over and retain the dispatch evidence.', 'The receiving branch should confirm what arrived; investigate differences.'] },
            { title: 'Reconcile central stock', page: 'inventory', action: 'Open Inventory (if authorized)', steps: ['Compare physical stock with recorded stock after each dispatch.', 'Use the movement history to trace each difference.', 'Escalate discrepancies and never confirm a movement you did not witness or verify.'] }
        ]
    },
    accounting: {
        label: 'Accounting Staff',
        intro: 'Use the finance pages granted to your account. Sensitive company-wide records may be restricted by the employer.',
        slides: [
            { title: 'Check your permitted finance scope', page: 'accounting', action: 'Open Accounting', steps: ['Confirm the selected company or branch and reporting period.', 'Use only the accounts and records visible to your role.', 'Company loans are hidden unless the employer explicitly grants access.'] },
            { title: 'Review transactions and evidence', page: 'accounting', action: 'Open Accounting', steps: ['Check each entry has a date, amount, category and supporting reference.', 'Review pending items and ask the responsible approver to approve or reject them.', 'Do not approve your own submitted expense or fabricate a balancing entry.'] },
            { title: 'Check ledger reports', page: 'accounting', action: 'Open Accounting', steps: ['Use available ledger reports to compare debits and credits and review balances.', 'Investigate unexpected balances against source receipts and approved expenses.', 'Export reports for review; statutory reporting and bank reconciliation may require external accounting tools.'] }
        ]
    },
    employee: {
        label: 'All Employees',
        intro: 'Use the shared employee tools and follow your manager’s process for your assigned work.',
        slides: [
            { title: 'Sign in and check your instructions', page: 'dashboard', action: 'Open Dashboard', steps: ['Sign in using your own account and check the correct branch is selected.', 'If company policies require acknowledgment, read and sign them before starting work.', 'Never share your password, passkey or account with another person.'] },
            { title: 'Record attendance', page: 'attendance', action: 'Open My Attendance', steps: ['Choose the assigned attendance device or method if prompted.', 'Clock in when you begin work and clock out when you finish.', 'Tell your manager promptly if the device, phone or connection fails. Do not clock in for another person.'] },
            { title: 'Use company tools responsibly', page: 'browse-inventory', action: 'Browse Items', steps: ['Use Browse Items to check information available to your role.', 'Use Messages for work communication and keep customer or company information private.', 'Open My Salary to view your available pay details and report discrepancies to the employer.'] },
            { title: 'Ask for access or help', page: 'messages', action: 'Open Messages', steps: ['If a task or page is missing, ask your manager or employer to grant the appropriate permission.', 'Use the Workflow Tutorial to return to instructions at any time.', 'Report suspicious access, missing stock or incorrect records promptly.'] }
        ]
    }
};

class TutorialPage {
    constructor() { this.roleKey = 'employee'; this.slideIndex = 0; }

    availableRoles() {
        const user = auth.user || {};
        if (user.role === 'employer') return user.isPrimaryEmployer === false ? ['co_employer'] : ['employer'];
        const roles = user.activeRoles || [];
        const available = [];
        if (roles.includes('manager')) available.push('manager');
        if (roles.includes('cashier')) available.push('cashier');
        if (roles.includes('sales')) available.push('sales');
        if (roles.includes('shop_buyer')) available.push('shop_buyer');
        if (roles.includes('stock')) available.push(user.isMainStock ? 'main_stock' : 'stock');
        if (roles.includes('accounting')) available.push('accounting');
        available.push('employee');
        return [...new Set(available)];
    }

    async render(container) {
        this.container = container;
        const roles = this.availableRoles();
        if (!roles.includes(this.roleKey)) this.roleKey = roles[0] || 'employee';
        this.slideIndex = 0;
        this.roles = roles;
        this.draw();
    }

    draw() {
        const workflow = tutorialWorkflows[this.roleKey] || tutorialWorkflows.employee;
        const slide = workflow.slides[this.slideIndex];
        const canOpenPage = Boolean(slide.page && access.canAccess(slide.page));
        const stepList = slide.steps.map((step, index) => `<li><span class="tutorial-step-number">${index + 1}</span><span>${utils.escapeHtml(step)}</span></li>`).join('');
        const options = this.roles.map(key => `<option value="${key}" ${key === this.roleKey ? 'selected' : ''}>${utils.escapeHtml(tutorialWorkflows[key].label)}</option>`).join('');
        const progress = ((this.slideIndex + 1) / workflow.slides.length) * 100;
        this.container.innerHTML = `
            <section class="tutorial-wrap">
                <div class="card tutorial-heading">
                    <div><span class="tutorial-kicker"><i class="fas fa-route"></i> SYSTEM WORKFLOWS</span><h2>Learn your day-to-day tasks</h2><p>${utils.escapeHtml(workflow.intro)}</p></div>
                    <label class="tutorial-role-picker">Tutorial for <select id="tutorial-role">${options}</select></label>
                </div>
                <div class="tutorial-progress" aria-label="Tutorial progress"><span style="width:${progress}%"></span></div>
                <article class="card tutorial-slide">
                    <div class="tutorial-slide-meta"><span>${utils.escapeHtml(workflow.label)} workflow</span><span>Slide ${this.slideIndex + 1} of ${workflow.slides.length}</span></div>
                    <h3>${utils.escapeHtml(slide.title)}</h3>
                    <ol class="tutorial-steps">${stepList}</ol>
                    <div class="tutorial-slide-actions">
                        <button class="btn btn-secondary" id="tutorial-prev" ${this.slideIndex === 0 ? 'disabled' : ''}><i class="fas fa-arrow-left"></i> Previous</button>
                        ${canOpenPage ? `<button class="btn btn-primary" id="tutorial-open"><i class="fas fa-external-link-alt"></i> ${utils.escapeHtml(slide.action)}</button>` : '<span class="tutorial-page-unavailable">Your account has no direct access to the related page.</span>'}
                        <button class="btn btn-secondary" id="tutorial-next" ${this.slideIndex === workflow.slides.length - 1 ? 'disabled' : ''}>${this.slideIndex === workflow.slides.length - 1 ? 'Finished' : 'Next'} <i class="fas fa-arrow-right"></i></button>
                    </div>
                </article>
                <div class="tutorial-footer"><i class="fas fa-shield-alt"></i> Your available pages depend on employer permissions. If a page is missing, ask your employer or manager to review your access.</div>
            </section>`;
        this.container.querySelector('#tutorial-role')?.addEventListener('change', event => { this.roleKey = event.target.value; this.slideIndex = 0; this.draw(); });
        this.container.querySelector('#tutorial-prev')?.addEventListener('click', () => this.go(-1));
        this.container.querySelector('#tutorial-next')?.addEventListener('click', () => this.go(1));
        this.container.querySelector('#tutorial-open')?.addEventListener('click', () => router.navigate(slide.page));
    }

    go(direction) {
        const slides = tutorialWorkflows[this.roleKey].slides;
        this.slideIndex = Math.max(0, Math.min(slides.length - 1, this.slideIndex + direction));
        this.draw();
    }
}

const pageTutorial = new TutorialPage();
