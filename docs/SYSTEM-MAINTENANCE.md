# System maintenance guide

## Who you are in the system

The first company owner account is the **employer**. It is the highest company-level role in the current application: it manages company setup, users, role permissions, branches, settings, and company-wide records. Use a named employer account for each real person; do not share credentials. The current code does not have a separate cross-company “central employer” or shareholder governance layer.

## Regular maintenance

### Daily

- Review failed login/security alerts, pending payments, transfer approvals, purchase records, attendance exceptions, and audit entries.
- Confirm backups completed. Investigate errors in application logs without copying tokens, passwords, customer data, or biometric data into tickets.
- Review pending approvals before stock leaves a warehouse or a payment is marked confirmed.

### Weekly

- Review user accounts and delegated permissions; remove access promptly when a person changes role or leaves.
- Check branch and warehouse balances, unresolved discrepancies, customer credits, loan entries, and cash totals against source documents.
- Review disk/storage capacity, failed WhatsApp/email deliveries, and service health.

### Monthly and after each release

- Verify a database backup can be restored into a separate environment.
- Reconcile accounting ledger entries to bank statements, loan schedules, supplier invoices, customer credit, cash sessions, and payroll. The application ledger is not a substitute for a qualified accountant or statutory accounting review.
- Patch supported Node.js/dependencies and the operating system in staging first. Review security advisories, deploy during a controlled window, and retain a rollback point.
- Check admin/employer accounts, API keys, integration tokens, CORS allowlist, TLS certificate expiry, log retention, and access records.

## Security operating rules

- Use unique passphrases and least privilege. Keep employer accounts limited, and grant manager task permissions only when needed.
- Store secrets only in the host's secret manager/environment. Rotate exposed credentials and revoke old integration tokens.
- Require HTTPS, database network restrictions, tested backups, monitoring, and a written process for reporting suspected fraud or compromise.
- Keep audit records. Do not use ordinary browser input as proof of fingerprint/Face ID; connect a supported platform authentication or trusted terminal.
- Treat AI output and document analysis as recommendations. A human must approve hiring, payment, payroll, credit, and accounting decisions.

## Operating the deployment

The hosting provider or designated system administrator maintains the server, database, DNS, certificates, backups, monitoring, and software releases. The employer maintains company records, users, role assignments, and business approvals. Assign a named technical administrator; do not make every employee an employer.

See [HOSTING-AND-CAPACITOR.md](HOSTING-AND-CAPACITOR.md) for deployment details and [INTEGRATION-SETUP.md](INTEGRATION-SETUP.md) for external services and current automation limits.
