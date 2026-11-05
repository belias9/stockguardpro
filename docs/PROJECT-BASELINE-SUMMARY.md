# Project baseline summary

StockGuardPro is a browser-based, multi-branch inventory and workforce management application. Its frontend is plain JavaScript, HTML, and CSS; its API uses Express and Mongoose; MongoDB stores company data; Socket.IO supports realtime features. The repository also contains AI, WhatsApp, offline-sync, attendance, salary, receipts, purchasing, customer, and stock workflows.

The application is organized around a company, branches, warehouses, employees, inventory movements, receipts, payment confirmations, attendance, payroll, and audit history. Access is role-based and some tasks can be delegated by an employer.

Current limits found during review: WhatsApp group analysis depends on provider-delivered group events and is not a chat inbox; end-of-day reports are generated in app, but email/WhatsApp delivery is not automated; monthly salary cron is a reminder rather than payroll execution; phone passkeys require deployment-specific HTTPS/RP configuration; email delivery and mobile Capacitor packaging need setup; AI does not autonomously sell or approve transactions. Shareholder data and primary-employer scopes are company-level, not a full legal voting or multi-company holding-company system. Treat financial balances as requiring reconciliation and audit; no system can promise 100% security.
