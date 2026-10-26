# StockGuardPro — Roles & Permissions

> **Security-first:** Every role boundary is enforced at 3 layers:
> 1. **Menu** — item hidden if not permitted
> 2. **Route (frontend)** — page blocked via `accessMap`
> 3. **API (backend)** — route protected via `protect + authorize + authorizeFunction + authorizeBranch`
>
> **Never trust the frontend.** Backend always re-verifies.

---

## 1. Dimensions of Access

Every request is authorized across **4 dimensions**:

| Dimension | Source | Check |
|---|---|---|
| **Authentication** | JWT in `Authorization: Bearer` | `protect` middleware |
| **Role** | `user.role` (employer/employee) | `authorize(...)` |
| **Function** | `user.activeRoles[]` | `authorizeFunction(...)` |
| **Branch** | `user.branch` or `X-Branch-Id` header | `authorizeBranch(...)` |

If ANY dimension fails → **403 Forbidden**, logged to `AuditLog` with `severity: 'warning'`.

---

## 2. The 7 Roles

| # | Role | Scope | Created By | Max Count |
|---|---|---|---|---|
| 1 | **Employer** | Company-wide | Company registration | **3 per company** (hard limit) |
| 2 | **Manager** | Own branch | Employer | 1+ per branch |
| 3 | **Cashier** | Own branch | Employer | 1+ per branch |
| 4 | **Shop Buyer** | Own branch | Employer | 1+ per branch |
| 5 | **Stock** | Own warehouse | Employer | 1+ per warehouse |
| 6 | **Sales** | Own branch | Employer | 1+ per branch |
| 7 | **None** | Own branch | Employer | Unlimited |

**Rule:** Only **Employer** can create accounts. No self-registration after company exists.

---

## 3. Multi-Role Rules

An employee can hold **multiple roles simultaneously**.

**Example:** A person can be both **Cashier** and **Sales**.

**Rules:**
- Roles stored in `user.roles[]` array
- `user.activeRoles[]` = currently enabled roles
- Employer assigns/removes roles
- Employee switching a role does **not** require re-login (role switcher in UI)
- On every API request, backend reads `activeRoles[]` — if requested action needs a role they don't have active → 403
- **Security:** Deactivating a role blocks it immediately, even if user has valid JWT

---

## 4. Full Permission Matrix

Legend: ✅ allowed · ❌ denied · 🔒 requires approval · 🌐 own branch only · 🏢 all branches

### 4.1 Company & Users

| Action | Employer | Manager | Cashier | Shop Buyer | Stock | Sales | None |
|---|---|---|---|---|---|---|---|
| Create employee account | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign/remove roles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Close employee account | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Deactivate/reactivate account | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create/edit branch | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create/edit warehouse | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View all users | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| View own profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 4.2 Money

| Action | Employer | Manager | Cashier | Shop Buyer | Stock | Sales | None |
|---|---|---|---|---|---|---|---|
| Confirm money received | ✅ | 🌐 | 🌐 | ❌ | ❌ | ❌ | ❌ |
| Dispute transaction | ✅ | 🌐 | 🌐 | ❌ | ❌ | ❌ | ❌ |
| View cashier session | ✅ | 🌐 | 🌐 | ❌ | ❌ | ❌ | ❌ |
| View all transactions | ✅ | 🌐 | 🌐 | ❌ | ❌ | ❌ | ❌ |

**Security:** Cashier can ONLY confirm the amount **already on the receipt**. Cannot change it. If amount is wrong, must DISPUTE (creates audit log + notifies employer).

### 4.3 Inventory

| Action | Employer | Manager | Cashier | Shop Buyer | Stock | Sales | None |
|---|---|---|---|---|---|---|---|
| Add/edit item | ✅ | 🌐 | ❌ | ❌ | 🌐 | ❌ | ❌ |
| Upload item image | ✅ | 🌐 | ❌ | ❌ | 🌐 | ❌ | ❌ |
| Adjust stock | ✅ | 🌐 | ❌ | ❌ | 🌐 | ❌ | ❌ |
| View inventory | ✅ | 🌐 | ❌ | ❌ | 🌐 | 🌐 | ❌ |
| View cost price | ✅ | 🌐 | ❌ | ❌ | 🌐 (main only) | ❌ | ❌ |
| View selling price | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Start inventory mode | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Enter inventory count | ❌ | ❌ | ❌ | ❌ | 🌐 | ❌ | ❌ |
| See actual count | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |

**Security:** Cost price NEVER visible to Sales, Cashier, None. Enforced at serializer level — not just UI.

### 4.4 Receipts & Sales

| Action | Employer | Manager | Cashier | Shop Buyer | Stock | Sales | None |
|---|---|---|---|---|---|---|---|
| Create receipt | ✅ | ✅ | ❌ | ❌ | ❌ | 🌐 | ❌ |
| Sell below listed price | ✅ | 🌐 🔒 | ❌ | ❌ | ❌ | 🔒 | ❌ |
| Approve below-price sale | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cancel receipt | ✅ | 🌐 | ❌ | ❌ | ❌ | 🌐 (own) | ❌ |
| Refund receipt | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Set selling price | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manual WhatsApp send | ✅ | 🌐 | ❌ | ❌ | ❌ | 🌐 | ❌ |

**Security:** Below-price sale **blocks backend** until approved. Cannot bypass by editing JS.

### 4.5 Withdrawals & Transfers

| Action | Employer | Manager | Cashier | Shop Buyer | Stock | Sales | None |
|---|---|---|---|---|---|---|---|
| Create withdrawal | ✅ | ✅ | ❌ | ❌ | ❌ | 🌐 | ❌ |
| Approve withdrawal | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reject withdrawal | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Confirm dispatch | ✅ | ❌ | ❌ | ❌ | 🌐 | ❌ | ❌ |
| Confirm receipt (destination) | ✅ | ❌ | ❌ | ❌ | 🌐 | ❌ | ❌ |
| Complete withdrawal | ✅ | 🌐 | ❌ | ❌ | ❌ | 🌐 | ❌ |
| Approve inter-branch transfer | ✅ | 🌐 (source) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve inter-warehouse transfer | ✅ | 🌐 (source) | ❌ | ❌ | ❌ | ❌ | ❌ |

**Security:** Stock personnel do NOT approve — only dispatch/receive. Approval is Manager/Employer only.

### 4.6 Pre-Record (Shop Buyer)

| Action | Employer | Manager | Cashier | Shop Buyer | Stock | Sales | None |
|---|---|---|---|---|---|---|---|
| Create pre-record | ❌ | ❌ | ❌ | 🌐 | ❌ | ❌ | ❌ |
| Edit pre-record (before confirm) | ❌ | ❌ | ❌ | 🌐 | ❌ | ❌ | ❌ |
| Confirm/reject pre-record | ✅ | 🌐 | ❌ | ❌ | 🌐 | ❌ | ❌ |
| View pre-records | ✅ | 🌐 | ❌ | 🌐 | 🌐 | ❌ | ❌ |

**Security:** Pre-record cannot become stock until confirmed. Receipt image is **required** on the last item.

### 4.7 Attendance

| Action | Employer | Manager | Cashier | Shop Buyer | Stock | Sales | None |
|---|---|---|---|---|---|---|---|
| Clock in/out | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own attendance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View team attendance | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Review absence | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign biometric device | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Enroll own biometrics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Security:** Attendance page hidden unless device assigned to that employee. Biometric template is hashed — never sent back.

### 4.8 Salary

| Action | Employer | Manager | Cashier | Shop Buyer | Stock | Sales | None |
|---|---|---|---|---|---|---|---|
| Set base salary | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Set deduction rules | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Generate salaries (all) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Generate salaries (branch) | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Add bonus/allowance | ✅ | 🌐 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve bonus | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve advance | ✅ | 🌐 (limit) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Pay salary | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| View own salary | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all salaries | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Request advance | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dispute salary | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Resolve dispute | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Download payslip | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Security:** Manager can approve advances up to ₦50,000 (configurable). Above → Employer only.
**Security:** Bonuses added by Manager require Employer approval before salary generation.

### 4.9 Customer

| Action | Employer | Manager | Cashier | Shop Buyer | Stock | Sales | None |
|---|---|---|---|---|---|---|---|
| View customer list | ✅ | 🌐 | ❌ | ❌ | ❌ | 🌐 | ❌ |
| View customer details | ✅ | 🌐 | ❌ | ❌ | ❌ | 🌐 | ❌ |
| Reply to WhatsApp | ✅ | 🌐 | ❌ | ❌ | ❌ | 🌐 | ❌ |
| Create order for customer | ✅ | 🌐 | ❌ | ❌ | ❌ | 🌐 | ❌ |
| View conversation history | ✅ | 🌐 | ❌ | ❌ | ❌ | 🌐 | ❌ |

### 4.10 Audit & System

| Action | Employer | Manager | Cashier | Shop Buyer | Stock | Sales | None |
|---|---|---|---|---|---|---|---|
| View audit trail | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Export audit | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View end-of-day report | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Update company settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Set receipt WhatsApp threshold | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Set open/close times | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Enable/disable feature | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Security:** Audit log is **immutable**. No user, not even Employer, can delete or modify. Only append.

### 4.11 AI Assistant

| Action | Employer | Manager | Cashier | Shop Buyer | Stock | Sales | None |
|---|---|---|---|---|---|---|---|
| Business insights | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Stock query (own branch) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI-assisted stock input | ✅ | 🌐 | ❌ | ❌ | 🌐 | ❌ | ❌ |
| Voice commands | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Generate report | ✅ | 🌐 | ❌ | ❌ | ❌ | ❌ | ❌ |

**Security:** AI sees selling prices only. **Cost prices never sent to OpenAI.**

---
 ## 4.12 Financial Visibility

| Metric | Employer | Manager | Cashier | Stock (Main) | Stock (Assist) | Sales | Shop Buyer |
|---|---|---|---|---|---|---|---|
| Cost price per item | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Selling price | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Transaction total | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Daily profit | ✅ | ✅ (branch) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Structure value | ✅ | ✅ (own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Company value | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Profit margin % | ✅ | ✅ (branch) | ❌ | ❌ | ❌ | ❌ | ❌ |

**Enforcement:** Profit and cost fields are **stripped from API responses** based on role — not just hidden in UI.
## 5. Branch Isolation — HARD RULE

Every API call is scoped to a branch:

```js
// Pseudocode — real code in S15
const branchScope = req.user.role === 'employer'
  ? (req.headers['x-branch-id'] || 'all')          // employer can pick
  : req.user.branch;                                // employee locked

if (branchScope !== 'all') {
  query.branch = branchScope;
}