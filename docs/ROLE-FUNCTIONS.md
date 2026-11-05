# Role functions in the current application

| Role | Main responsibilities and visible areas |
|---|---|
| Employer | Company-wide setup, branches/warehouses, users, permissions, accounting, inventory, receipts, purchasing, attendance, salary, customers, audit, reports, settings, approvals. |
| Manager | Assigned branch operations; approvals, branch inventory/receipts, payment confirmation, inventory checks, and purchase entry. Specific write actions remain subject to API permissions. |
| Cashier | Cashier sessions, payments, and payment confirmation/dispute workflows. |
| Sales | Create and review sales receipts, browse available goods, and customer sales tasks allowed to their branch. |
| Shop buyer | Submit purchase pre-records with item/receipt photos for review and stock entry. |
| Stock | Branch stock operations, purchase record entry, and withdrawal/transfer workflows. Main stock dispatches require approvals and record collector details. |
| Accounting | Accounting pages and salary views where assigned; employer can grant additional accounting permissions. |
| None/basic employee | Personal attendance, salary, messages, settings, and browse inventory according to branch access. |

Users may have multiple active functions and employer-delegated permissions. Menu visibility is not a security boundary: backend authorization must decide every request. Review `backend/middleware/auth.js`, `frontend/js/navigation/menuConfig.js`, and `frontend/js/navigation/accessMap.js` when roles change. This is a summary of current implementation, not a promise that every task in the requested future design is complete.
