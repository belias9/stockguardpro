# StockGuardPro — Workflows

> **Security-first:** Every workflow has explicit **security gates**. No step can be skipped.
> If a gate fails → **403 + audit log** (severity: warning).

---

## Workflow 1 — Sale → Receipt → Withdrawal → Dispatch → Collection

**Purpose:** Sell items from any warehouse to a customer.

### Steps

### Failure Modes

| Step | If fails | Response |
|---|---|---|
| 1. Receipt | Insufficient stock | Warning shown, sale can proceed (system allows 0-stock sale) |
| 1. Below-price | Not approved | Receipt saved as DRAFT, blocks till approval |
| 2. Withdrawal | Item is 0 qty | Blocked |
| 3. Approval | Approver = requester | Blocked (self-approval) |
| 4. Dispatch | Stock insufficient | Blocked, admin alerted |
| 4. Dispatch | Race condition | Atomic transaction — 2nd fails gracefully |
| 6. Cashier | Amount mismatch | Can only DISPUTE (logged), not change |

### Audit Trail

Every step logs to `AuditLog`:
- Actor (user + role + branch)
- Before/after state
- Request details (IP, user agent)
- Result (success/fail)

---

## Workflow 2 — Attendance → Salary

**Purpose:** Track attendance, calculate salary, pay employees.

### Steps

### Failure Modes

| Step | If fails | Response |
|---|---|---|
| 1. Clock in | No device assigned | UI hides button; block |
| 1. Clock in | Biometric mismatch | 3 attempts, then lockout 5 min |
| 4. Generation | Employee data incomplete | Warning, proceed (treat as absent) |
| 6. Pay | Already paid | Blocked |
| 7. Dispute | Over 30 days | Blocked (auto-resolution) |

---

## Workflow 3 — Branch Inventory Management

**Purpose:** Track stock per warehouse independently.

### Steps

### Security Concerns

- **Biometric templates:** Never sent back to client. Only hashed comparisons.
- **Replay attacks:** WebAuthn challenge nonce, expires in 60s
- **Device spoofing:** Each device has API key (`X-Device-Key` required)
- **Lost phone:** Employer can revoke device → immediate block

---

## Workflow 6 — Audit Trail

### Every Action Logs

```json
{
  "action": "WITHDRAWAL_APPROVE",
  "entityType": "Withdrawal",
  "entityId": "ObjectId",
  "entityName": "WD-241024-0421",
  "performedBy": "ObjectId",
  "performedByName": "John Doe",
  "performedByRole": "manager",
  "branch": "ObjectId",
  "changes": { "before": {}, "after": {} },
  "requestDetails": { "ipAddress": "", "userAgent": "", "method": "", "path": "" },
  "result": { "success": true, "statusCode": 200 },
  "severity": "info",
  "company": "ObjectId",
  "timestamp": "Date"
}   




1. SHOP BUYER goes out to purchase
   ├── Opens "New Purchase"
   ├── Picks: default warehouse OR another branch
   ├── Enters item 1 → item 2 → item 3 (any order)
   ├── On LAST item → must attach receipt image
   └── Saves as pre-record

   🔒 Gate: only Shop Buyer role
   🔒 Gate: receipt image required on last item
   🔒 Gate: cannot save without image
   └── On success: status `pending`

2. Can edit before confirmation
   ├── Change items, qty, price
   └── Replace receipt image

   🔒 Gate: only if status = `pending`
   🔒 Gate: only by original buyer

3. STOCK confirms
   ├── Reviews items
   ├── Verifies receipt image
   └── Confirms or rejects

   🔒 Gate: only Stock of selected warehouse
   🔒 Gate: only if status = `pending`
   └── On confirm: items enter stock (movement type `in`)

4. On reject
   ├── Buyer notified
   ├── Buyer must correct
   └── New round of confirmation





   workflow 8



   1. SHOP BUYER goes out to purchase
   ├── Opens "New Purchase"
   ├── Picks: default warehouse OR another branch
   ├── Enters item 1 → item 2 → item 3 (any order)
   ├── On LAST item → must attach receipt image
   └── Saves as pre-record

   🔒 Gate: only Shop Buyer role
   🔒 Gate: receipt image required on last item
   🔒 Gate: cannot save without image
   └── On success: status `pending`

2. Can edit before confirmation
   ├── Change items, qty, price
   └── Replace receipt image

   🔒 Gate: only if status = `pending`
   🔒 Gate: only by original buyer

3. STOCK confirms
   ├── Reviews items
   ├── Verifies receipt image
   └── Confirms or rejects

   🔒 Gate: only Stock of selected warehouse
   🔒 Gate: only if status = `pending`
   └── On confirm: items enter stock (movement type `in`)

4. On reject
   ├── Buyer notified
   ├── Buyer must correct
   └── New round of confirmation





   workflow 9



   1. CUSTOMER messages company WhatsApp
   ├── Number registered with Meta Business
   └── Webhook receives message

   🔒 Gate: webhook signature verified (HMAC)
   🔒 Gate: phone number must be a customer (create if new)
   └── On verify fail: silently dropped, logged

2. System responds (auto)
   ├── Sends catalog images (approved items)
   ├── Sends selling prices (employer-approved)
   └── Asks what they want

   🔒 Gate: prices MUST be employer-approved
   🔒 Gate: cost prices NEVER sent
   └── Rate limit: 5 auto-replies per customer per day

3. If browsing → continue auto
   If negotiation:
   ├── System escalates to human
   ├── Employer/Manager/Sales takes over
   └── Human conversation replaces auto

   🔒 Gate: escalation logged
   🔒 Gate: human must have appropriate role
   └── On success: customer record updated

4. Order creation
   ├── Human creates order in system
   ├── Order tied to customer
   └── Standard workflow from here (Workflow 1)



   workflow 10,




   1. At employer-set time (default 22:00), cron runs
   ├── Generates report per branch
   ├── Includes: goods bought, attendance, faulty goods,
   │             cashier, transfers, alerts, AI insights
   └── Queued for delivery

2. Delivery
   ├── In-app (notification + view)
   └── WhatsApp (message with summary + link)

   🔒 Gate: only Employer receives
   🔒 Gate: rate limit 1 per branch per day
   └── On success: audit log

3. If delivery fails
   ├── Retry 3 times over 15 minutes
   ├── If still fails: log critical + notify
   └── Report viewable in-app regardless
EOD Report — Cashier Section (employer version):

CASHIER
- Transactions today: 15
- Total received: ₦2,340,000
- Total amount sold (gross): ₦2,340,000
- Total cost of goods sold: ₦1,560,000
- Total profit: ₦780,000
- Profit margin: 33.3%
- Disputed: 1
- Pending: 0

EOD Report — Cashier Section (cashier version, server-stripped):

CASHIER
- Transactions today: 15
- Total received: ₦2,340,000
- Total amount sold (gross): ₦2,340,000
- Disputed: 1
- Pending: 0



   workflow 11


   1. SALES creates receipt
   ├── Tries to sell at price below listed
   └── System blocks

2. PriceApproval created
   ├── Status: `pending`
   ├── Sent to Manager + Employer
   └── Receipt saved as DRAFT

   🔒 Gate: only Sales can create
   🔒 Gate: only if price < listed price
   └── On success: notification to Manager + Employer

3. Manager/Employer reviews
   ├── Sees original price, proposed price, reason
   └── Approves or rejects

   🔒 Gate: only Manager (own branch) or Employer
   🔒 Gate: cannot approve own request
   └── On approve: receipt moves to `finalized`

4. On reject
   ├── Sales notified
   ├── Must use listed price OR abandon
   └── Receipt remains DRAFT until updated






   workflow 12





   1. Transfer initiated
   ├── Source warehouse → destination warehouse
   ├── Both must be in same company
   └── Items + quantities specified

   🔒 Gate: source and destination must be active
   🔒 Gate: source must have sufficient stock

2. MANAGER (source branch) approves
   ├── Reviews transfer
   └── Approves or rejects

   🔒 Gate: only Manager of SOURCE branch
   🔒 Gate: cannot approve if status ≠ `pending`
   └── On approve: status → `approved`

3. STOCK (source) confirms dispatch
   ├── Physically verifies items
   ├── Confirms dispatch
   └── Source stock decremented

   🔒 Gate: only Stock of source warehouse
   🔒 Gate: atomic decrement
   └── On success: status → `in_transit`

4. STOCK (destination) confirms receipt
   ├── Physically verifies
   ├── Confirms receipt
   └── Destination stock incremented

   🔒 Gate: only Stock of destination warehouse
   🔒 Gate: cannot confirm if status ≠ `in_transit`
   └── On success: status → `completed`

5. All steps logged to audit





workflow 13 



1. Branch operates offline
   ├── All actions saved to LOCAL MongoDB
   ├── Every write ALSO queued in `SyncQueue` table
   └── UI shows "Offline" badge

   🔒 Gate: local server authenticates via shared JWT secret
   🔒 Gate: writes use local user auth (same JWT)
   └── On success: action visible locally

2. Internet returns
   ├── Background job (every 30s) checks connectivity
   ├── On online: sync queue starts flushing
   └── Push in chronological order

   🔒 Gate: cloud API requires valid JWT (same secret)
   🔒 Gate: each sync request signed with HMAC
   └── On success: queue item removed

3. Conflicts resolved
   ├── Timestamp-based (newer wins for non-critical)
   ├── Local authority for stock movements (no rollback)
   └── Manual review for ambiguous (rare)

   🔒 Gate: never overwrite cloud audit log
   🔒 Gate: never delete audit entries
   └── On conflict: flag + notify admin

4. WhatsApp / AI / cloud reports resume
   ├── Queued messages sent
   ├── AI analysis refreshed
   └── End-of-day report sent



workflow 14


## Workflow 14 — Structure Value & Profit Report

### Purpose
Employer can pull any structure's value and profit at any time.

### Steps

1. EMPLOYER opens Reports → "Structure Value"
   ├── Selects date range
   ├── Selects structure (or "all structures")
   └── Clicks "Generate"

   🔒 Gate: only Employer (any structure) or Manager (own branch)
   🔒 Gate: date range max 1 year
   └── On success: server calculates

2. Server calculates per structure:
   ├── Stock value (cost) = Σ (quantity × unitCost)
   ├── Stock value (selling) = Σ (quantity × sellingPrice)
   ├── Potential profit = selling − cost
   ├── Sold this period = Σ receipt totals
   ├── Cost of goods sold = Σ (receipt qty × unitCost)
   ├── Actual profit = sold − COGS
   └── Profit margin = profit / sold × 100

   🔒 Gate: cost prices only visible to employer/manager
   └── On success: response sanitized by role

3. Response returned
   ├── Employer: full data, all structures
   ├── Manager: only own branch structures
   └── Cashier/Stock/Sales: 403 forbidden

4. Export available
   ├── CSV download
   └── PDF report (signed URL, 1h expiry)

### Security Concerns

- **Profit is server-calculated** — never client
- **Cost fields stripped** for unauthorized roles
- **Rate limit:** 10 reports/hour per user
- **Every report generated → audit log**
