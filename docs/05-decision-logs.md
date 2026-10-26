# Decision Log — All Confirmed Decisions

## 2026-10-24 — Employer Count
- Max **3 employers per company**
- Enforced at model + service level

## 2026-10-24 — Branch Authority
- **Manager = branch authority**
- No separate "branch employer" role
- Manager handles: transfers approval, salary (own branch), price approvals, inventory mode

## 2026-10-24 — Multi-Role
- Employees can have **multiple roles simultaneously**
- Only **employer** can assign/remove roles
- Roles assigned via `User.roles: []` array

## 2026-10-24 — Cashier
- **Per branch**, switchable
- **Confirms money only** (does not approve products)
- Can also have Sales role
- Receives only money listed on receipt

## 2026-10-24 — Shop Buyer
- Replaces old "Buyer" role
- **Pre-record workflow** — buyer records purchases → stock confirms
- Can pick warehouse (default = own branch warehouse)
- Can buy for another branch
- Multiple purchases per day
- Editable before confirmation
- Receipt image attaches to **last item only**

## 2026-10-24 — Inventory Mode
- Employer **or Manager** can start/end
- All quantities **blurry** during mode
- Sales **continue** (can sell at 0 stock)
- Only **employer + manager** see actual count
- Surplus/lacking calculated per item
- Report sent to employer
- Sales made at 0 stock auto-deducted on restock

## 2026-10-24 — Attendance
- Employer assigns **any employee's phone** as biometric device
- Employee enters **name OR employee ID** + biometric
- Supports **fingerprint AND face ID**
- Attendance page **hidden** unless device assigned to that employee
- Old device deactivated when reassigned

## 2026-10-24 — WhatsApp Receipt
- Auto-send when receipt total ≥ threshold (default ₦50,000, configurable)
- Manual send by salesperson after receipt completion

## 2026-10-24 — Inter-Warehouse & Inter-Branch Transfers
- **Manager approves only** (not stock personnel)
- Stock personnel confirm dispatch + receipt (no approval)

## 2026-10-24 — Below-Price Sales
- Requires **manager OR employer** approval
- Not available to sales person directly
- Logged to audit trail

## 2026-10-24 — Salary
- **Auto + manual** generation (auto on 1st of month)
- **Manager advance limit:** ₦50,000 per request, ₦100,000 per month (configurable)
- **Advance cap:** 50% of base salary
- **Employee does NOT confirm payment** (marked paid = done)
- **Bonus approval:** Employer approves bonuses added by manager
- **Payslip PDF:** Available for download
- **Incomplete attendance:** Allow with warning (treat missing days as absent)

## 2026-10-24 — Permissions
- Employer: **everything**
- Employer + Manager: **confirm money**, **inventory mode**
- Manager: **transfer approvals**, **own branch salary**
- All employees AI: **selling prices only**
- Manager + Main Stock: **cost prices visible**
- Sales receipts printed: **selling prices only, no warehouse location**

## 2026-10-24 — End of Day Report
- Sent to employer at employer-set time
- Delivery: **in-app + WhatsApp**
- Contains: goods bought, attendance, faulty goods, cashier, transfers, alerts, AI insights

## 2026-10-24 — Offline
- **Partial offline** via LAN server per branch
- Branch operates fully offline
- Syncs to cloud when internet returns
- Wired connection for cashier, sales, main stock personnel
- WiFi for shop buyer + attendance device

## 2026-10-24 — Customization
- **Scope B — Flexible**
- Custom categories per company
- Custom units per company
- Custom fields per item
- Feature toggles (enable/disable modules)
- Multi-currency (per branch)
- Custom receipt template

## 2026-10-24 — Build Order
- **Path A** — build everything
- **Segmented** into 68 segments across 10 phases
- User does most of the work
- AI delivers per segment on request

## 2026-10-24 — Mobile App
- **Capacitor** for future mobile wrap
- No rewrite needed
- Backend stays identical