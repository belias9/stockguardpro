# Accounting ledger, sync, and database recovery

This note describes the code-backed ledger and the recovery tools. It does not replace local accounting advice or an external security review.

## Double-entry ledger

The Accounting page now provides a chart of default accounts, journal entries, Trial Balance, Income Statement, and Balance Sheet. Every posted journal line must have a debit or credit (not both), and the total debits must equal total credits to the cent.

Approved entries entered through the existing accounting workflow are posted to the ledger using these default mappings:

| Event | Debit | Credit |
| --- | --- | --- |
| Income | Cash on Hand | Other Income |
| Expense | Operating Expenses | Cash on Hand |
| Customer credit sale | Accounts Receivable | Sales Income |
| Customer credit payment | Cash on Hand | Accounts Receivable |
| Loan received | Cash on Hand | Loans Payable |
| Loan repayment | Loans Payable | Cash on Hand |
| Loan issued | Loans Receivable | Cash on Hand |
| Loan recovered | Cash on Hand | Loans Receivable |
| Confirmed cash/card/bank sale | Cash or Bank, plus Cost of Goods Sold | Sales Income, tax payable, plus Inventory Asset |
| Confirmed credit sale | Accounts Receivable, plus Cost of Goods Sold | Sales Income, tax payable, plus Inventory Asset |

These are starter mappings. Receipt sales use the receipt's stored tax and cost totals; mixed tender currently posts to Cash on Hand because the app does not capture a split by payment method. The system does not yet post stock purchases/opening inventory, supplier bills, payroll, refunds, or cancellations into a complete ledger; it also lacks bank reconciliation, fiscal-year closing, and country-specific statutory accounts. Have an accountant review the chart and mappings before using these statements as official books.

Existing approved Accounting entries and confirmed receipts are not automatically backdated when the feature is deployed. An employer can use **Post existing approved entries** and **Post existing confirmed receipts** separately to backfill them. Each operation skips source records that already have a journal posting. Receipt backfill may duplicate sales previously entered manually as accounting income; back up first and reconcile the source records before running it.

Manual journal entries are immutable after posting. Use a separate correcting journal entry for corrections. Entries made through delegated creation may remain pending until another authorized person approves them. Cashier accounts cannot access the formal journal or statements. Loan accounts remain hidden unless the employer grants loan access.

## Local to cloud synchronization

Supported branch models now enqueue writes in local mode: inventory, receipts, withdrawals, attendance, salary, purchase pre-records, customers with an assigned branch, customer orders, cashier sessions, inventory audits, Accounting entries, and manual journal entries. Cloud processing validates the signed company and branch, protects tenant-scoped updates, uses idempotent create IDs, and compares per-record sync revisions to detect competing changes.

Synchronization is a **branch to cloud push**, not a two-way database replica. User accounts, company configuration, and all other models are not automatically pulled from the cloud into branch databases. Revision conflicts remain in the queue for human review. A branch's local database remains its immediate source of truth while offline; keep independent backups.

Set `SYNC_SECRET` to the same long random secret on the branch and cloud servers. It must be at least 32 characters and must not reuse either JWT secret. Keep sync traffic on HTTPS.

## Create a database backup

Install MongoDB Database Tools (`mongodump` and `mongorestore`) on the server. Configure the database URI in `backend/.env`, then run from `backend/`:

```powershell
npm.cmd run backup:db
```

The default output is `backend/backups/`; set `BACKUP_DIR` to an encrypted, access-controlled location to store backups elsewhere. The script does not delete old archives. Protect backups as sensitive company data and copy them off the server.

## Restore a backup

Restore into a **separate staging database first**. Check the target URI carefully. From `backend/`, in PowerShell:

```powershell
$env:CONFIRM_RESTORE = 'YES'
$env:RESTORE_MONGODB_URI = 'mongodb://127.0.0.1:27017/stockguardpro_restore_test'
npm.cmd run restore:db -- 'C:\path\to\stockguardpro-cloud-2026-01-01.archive.gz'
```

The restore command merges into the target by default. To replace matching collections, set `RESTORE_DROP=YES` deliberately before running; `mongorestore --drop` removes target collections before restoring them. Never test that option against production. Verify login, receipts, stock, accounting reports, uploads, and branch access after restore.

## Test guidance

The automated backend tests include cent-accurate balance validation and verify every automated source mapping creates one debit and one credit. Before go-live, also test accounting entries and manual journals in staging, approve/reject paths, branch permission boundaries, backfill, local sync outage/reconnect, conflict queue handling, and a full backup restore.
