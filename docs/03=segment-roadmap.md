# StockGuardPro — Segment Roadmap (68 Segments)

> **Security is a column, not an afterthought.**
> Every segment lists which security controls it implements or requires.
> No segment ships without: auth, authorization, validation, audit, rate limit, company+branch isolation.

---

## Phase 0 — Foundation (Week 1)

### S01 — Project Skeleton
- **Depends:** —
- **Effort:** 3h
- **Internet:** ✅ once (tools + npm install)
- **Security:** `.gitignore` (no secrets), `.env.example` (safe defaults)
- **Done when:** `npm install` works, git init, folder tree exists

### S02 — Database Setup
- **Depends:** S01
- **Effort:** 2h
- **Internet:** ⚠️ Optional (local Mongo = offline; Atlas = internet)
- **Security:** Connection over TLS (Atlas), strong DB user password, IP whitelist
- **Done when:** Local + cloud (if using) connect, health endpoint OK

### S03 — Core Middleware
- **Depends:** S01, S02
- **Effort:** 4h
- **Internet:** ❌
- **Security:**
  - Helmet with strict CSP
  - CORS locked to CLIENT_URL
  - Body size limit 1MB
  - `express-mongo-sanitize` (NoSQL injection)
  - `xss-clean` (XSS)
  - Rate limiter (global 100/15min)
  - Disable `x-powered-by`
  - Error handler that doesn't leak stack in prod
- **Done when:** All security middleware applies to every route; errors return clean JSON

---

## Phase 1 — Models (Week 2)

### S04 — Company + Branch + Warehouse Models
- **Depends:** S03
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - Company password hashed (bcrypt 12)
  - Branch requires `company` (tenant isolation)
  - Warehouse requires `branch`
  - Compound indexes on `{ company, branch, name }`
- **Done when:** Can create company → branch → warehouse; queries isolated

### S05 — User (Multi-Role) + Device Models
- **Depends:** S04
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - Password hashed (bcrypt 12)
  - `roles: []` — only employer can modify
  - `activeRoles: []` — checked on every request
  - `fingerprintTemplate`, `faceTemplate` — hashed, `select: false`
  - Enforce `MAX_EMPLOYERS_PER_COMPANY=3` via pre-save hook
  - Device has `apiKey` (hashed)
- **Done when:** Multi-role user created; max 3 employers enforced; device key stored hashed

### S06 — Inventory Model
- **Depends:** S04
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - Belongs to `warehouse` (not branch)
  - `quantity: { min: 0 }` (no negative)
  - `images: []` — URLs only (private bucket)
  - Compound unique index `{ warehouse, itemCode }`
  - Movement subdocs immutable (no update)
- **Done when:** Two warehouses hold same item independently; movements append-only

### S07 — Receipt + Withdrawal Models
- **Depends:** S04, S06
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - `paymentStatus` (pending/confirmed/disputed)
  - `cashierConfirmation` (who/when, no edit after set)
  - `securityHash` on withdrawal (tamper-proof)
  - Auto-generated IDs (RCP-YYMMDD-XXXX, WD-YYMMDD-XXXX)
- **Done when:** Receipt → auto-withdrawal works; security hash validates

### S08 — Attendance + Salary Models
- **Depends:** S05
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - `deviceId` recorded (biometric)
  - `fingerprintVerified: bool`, `faceVerified: bool`
  - Salary: advances array, deductions array (immutable after paid)
  - Compound unique `{ employee, period }` on salary
- **Done when:** Clock in/out works; salary record prevents duplicate period

### S09 — PreRecord + InventoryAudit Models
- **Depends:** S06, S07
- **Effort:** 0.5d
- **Internet:** ❌
- **Security:**
  - `receiptImage` required field
  - Status enum: pending/confirmed/rejected
  - Audit: startedBy, endedAt, items[] with actual vs system
- **Done when:** Pre-record with image saved; inventory audit session startable

### S10 — Customer + CustomerOrder Models
- **Depends:** S04
- **Effort:** 0.5d
- **Internet:** ❌
- **Security:**
  - Customer phone unique per company
  - PII flagged (name, phone, email)
  - Conversation log encrypted field (future)
- **Done when:** Customer created; order attached

### S11 — CashierSession + EndOfDayReport Models
- **Depends:** S07, S08
- **Effort:** 0.5d
- **Internet:** ❌
- **Security:**
  - Session date unique per cashier
  - Report content immutable after generation
  - Delivery status tracked
- **Done when:** Cashier session created per day; EOD report generated

### S12 — AuditLog + PriceApproval Models
- **Depends:** All above
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - Audit log: append-only (no update, no delete at model level)
  - Compound indexes on `{ company, timestamp }`, `{ action }`, `{ performedBy }`
  - PriceApproval: request requires reason
- **Done when:** Any action can log; below-price requests creatable

### S13 — Model Indexes + Relationship Audit
- **Depends:** S04–S12
- **Effort:** 4h
- **Internet:** ❌
- **Security:**
  - Verify every model has `company` field
  - Verify every model has `branch` (or branch-adjacent)
  - Verify every query naturally scopes to company + branch
  - Add compound indexes for common queries
- **Done when:** All queries < 100ms with 1000+ records; no cross-tenant leak

---

## Phase 2 — Services + Routes (Weeks 3–5)

### S14 — Auth Service + Routes
- **Depends:** S05, S12
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - JWT signing with `JWT_SECRET` (32+ chars)
  - Access token (7d) + refresh token (30d)
  - Refresh token rotation
  - bcrypt 12 for passwords
  - Fingerprint register **protected (employer only)**
  - Fingerprint verify with hash compare
  - Login rate limit: 5 attempts per 15 min per email
  - Lockout after 5 failures
- **Done when:** Login works; unauthorized fingerprint register → 403

### S15 — Company + Branch + Warehouse Service
- **Depends:** S04, S14
- **Effort:** 1.5d
- **Internet:** ❌
- **Security:**
  - Only employer can create/edit branch/warehouse
  - Branch/warehouse queries scoped to `req.user.company`
  - Attempt to access other company → 403 + audit log
- **Done when:** Employee cannot see other companies' branches

### S16 — User + Role Service
- **Depends:** S05, S15
- **Effort:** 1.5d
- **Internet:** ❌
- **Security:**
  - Only employer can create/delete users
  - Only employer can assign/remove roles
  - Max 3 employers enforced at creation
  - Deactivating a role → immediate 403 on next request (checked on every API call)
  - User queries scoped to `company`
- **Done when:** Role changes take effect immediately; max 3 employers enforced

### S17 — Inventory Service + Routes
- **Depends:** S06
- **Effort:** 2d
- **Internet:** ❌
- **Security:**
  - Only Stock (own warehouse) can add/edit
  - Only Manager + Employer see cost price
  - Image upload: MIME check, size limit 5MB, stored in private bucket
  - Inventory mode flags enforced
- **Done when:** Sales role blocked from cost price; images upload safely

### S18 — Receipt Service + Routes
- **Depends:** S07, S12, S17
- **Effort:** 2d
- **Internet:** ❌
- **Security:**
  - Receipt creation restricted to Sales role (own branch)
  - Below-price → requires PriceApproval before receipt finalizes
  - Total calculated server-side (never trust client)
  - Printed receipt excludes cost price + warehouse location
- **Done when:** Below-price sale blocked without approval; totals correct

### S19 — Withdrawal + Transfer Service
- **Depends:** S07, S17
- **Effort:** 2d
- **Internet:** ❌
- **Security:**
  - Approve: only Manager (own branch) or Employer
  - Approve: cannot approve own request
  - Dispatch: only Stock (source warehouse)
  - Atomic decrement (MongoDB `$inc` + `$gte` check)
  - Inter-branch requires valid source + destination
- **Done when:** Concurrent dispatches don't corrupt stock; self-approval blocked

### S20 — Cashier Service + Routes
- **Depends:** S11, S18
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - Cashier can ONLY confirm amount on receipt (no edit)
  - Dispute logged, notifies employer
  - Cashier scoped to own branch
  - Session totals verified server-side
- **Done when:** Cashier cannot change amount; disputes tracked

### S21 — PreRecord Service
- **Depends:** S09, S17
- **Effort:** 1.5d
- **Internet:** ❌
- **Security:**
  - Only Shop Buyer can create
  - Receipt image required on last item
  - Edit only if status = pending
  - Confirm only by Stock (selected warehouse)
- **Done when:** Cannot save pre-record without receipt image

### S22 — Inventory Mode Service
- **Depends:** S17
- **Effort:** 2d
- **Internet:** ❌
- **Security:**
  - Start: only Employer OR Manager
  - Blur: applied at serialization level (backend)
  - Actual qty: only visible to Employer + Manager
  - Auto-deduct 0-stock sales: queue with atomic check
- **Done when:** Stock role cannot see actual count during session

### S23 — Attendance Service
- **Depends:** S08, S05
- **Effort:** 1.5d
- **Internet:** ❌
- **Security:**
  - Clock in requires valid `X-Device-Key`
  - Biometric verify: hash compare (not raw template)
  - Name OR employee ID accepted
  - Rate limit: 1 clock-in per 5 min per user
  - Auto-mark at 23:59 (server-side cron)
- **Done when:** Attendance fails without valid device key

### S24 — Salary Service
- **Depends:** S08, S23
- **Effort:** 3d
- **Internet:** ❌
- **Security:**
  - Generate: Employer (all branches) or Manager (own branch)
  - Advance: cap 50%, manager limit ₦50,000
  - Bonus: manager adds → pending employer approval
  - Dispute: only within 30 days
  - Payslip: signed URL, expires 24h
- **Done when:** Manager advance over limit requires employer approval

### S25 — Customer + CustomerOrder Service
- **Depends:** S10
- **Effort:** 2d
- **Internet:** ❌
- **Security:**
  - Customer PII access restricted
  - Order creation restricted to Sales/Manager/Employer
  - Conversation log visible only to those with role
- **Done when:** Cashier cannot access customer PII

### S26 — Dashboard + Reports Service
- **Depends:** All above
- **Effort:** 2d
- **Internet:** ❌
- **Security:**
  - Dashboard scoped by role + branch
  - Reports filter by branch
  - Company value: only employer
  - Export rate-limited
- **Done when:** Manager sees only own branch numbers

### S27 — Audit Service + Routes
- **Depends:** S12
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - Log helper called from every write operation
  - Log entries append-only
  - Read: employer only
  - Export: rate-limited (5/hour)
- **Done when:** Every action generates an audit log entry

---

## Phase 3 — Integrations (Week 6)

### S28 — Socket.IO Real-Time
- **Depends:** S03
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - JWT verified on socket handshake
  - Socket joins only authorized company + branch rooms
  - No cross-company events
- **Done when:** Unauthorized socket rejected

### S29 — OpenAI Integration
- **Depends:** S03
- **Effort:** 2d
- **Internet:** ✅ (API calls)
- **Security:**
  - Lazy init (doesn't crash if no key)
  - Cost price NEVER sent to OpenAI
  - Prompt injection guards
  - Rate limit: 10 calls/min per user
  - Log all requests (without sensitive data)
- **Done when:** AI works; no cost prices in payloads

### S30 — WhatsApp Integration
- **Depends:** S03
- **Effort:** 2d
- **Internet:** ✅ (API + webhook)
- **Security:**
  - Webhook signature verified (HMAC-SHA256)
  - Invalid signature → silently drop + log
  - Template messages only (Meta-approved)
  - Phone number normalized
  - Receipt data: no cost price, no warehouse
- **Done when:** Invalid webhook POST rejected

---

## Phase 4 — Frontend Core (Week 7)

### S31 — Shell + Partials
- **Depends:** —
- **Effort:** 4h
- **Internet:** ❌
- **Security:**
  - CSP meta tags
  - No inline scripts in HTML
  - Subresource integrity on CDN links
- **Done when:** Shell loads without CSP errors

### S32 — Core JS
- **Depends:** S31
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - JWT in memory (not `localStorage` for access token — use httpOnly cookies in prod)
  - API client sends `X-Branch-Id` when set
  - Auto-logout on 401
  - Sanitize user-rendered content (use `textContent` where possible)
- **Done when:** XSS test payloads render as text, not HTML

### S33 — Navigation
- **Depends:** S32
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - `accessMap` matches backend permissions exactly
  - Hidden menu items not downloadable
- **Done when:** Direct URL to unauthorized page → redirect

### S34 — API Modules
- **Depends:** S32
- **Effort:** 1d
- **Internet:** ❌
- **Security:**
  - Every call routed through `apiClient` (never raw `fetch`)
  - Errors handled uniformly
  - No tokens in URLs
- **Done when:** All calls go through one client

---

## Phase 5 — Shared Pages (Week 8)

### S35 — Dashboard Page
- **Effort:** 6h · **Internet:** ❌
- **Security:** Role-aware rendering; no sensitive data in DOM for lower roles

### S36 — AI Page
- **Effort:** 6h · **Internet:** ✅ (when AI used)
- **Security:** Employee AI shows selling prices only; input sanitized before OpenAI

### S37 — Attendance Page
- **Effort:** 1d · **Internet:** ❌
- **Security:** Hidden unless device assigned; biometric prompt only if allowed

### S38 — Salary Page
- **Effort:** 1.5d · **Internet:** ❌
- **Security:** Manager sees own branch only; payslip download via signed URL

### S39 — Messages Page
- **Effort:** 6h · **Internet:** ❌
- **Security:** Message content sanitized; attachments MIME-checked

### S40 — Settings Page
- **Effort:** 2d · **Internet:** ❌
- **Security:** Employer only; changes require confirmation; audit logged

---

## Phase 6 — Employer Pages (Week 9)

### S41–S49 — Each page
- **Security (applies to all):**
  - Role + branch guard in router
  - Backend enforces same
  - Sensitive actions (delete, close account) require confirmation
  - All changes logged to audit

Specific highlights:
- **S41 Branches:** Only employer; manager assignment
- **S42 Users & Roles:** Max 3 employers enforced in UI + backend; role changes logged
- **S43 Inventory:** Cost price visible only to employer/manager
- **S44 Withdrawals:** Approval requires role check
- **S46 Inventory Mode:** Only employer/manager can start; quantities blurred for stock
- **S47 Customers:** PII access logged
- **S48 Audit:** Read-only, no delete button anywhere
- **S49 Reports:** Export rate-limited

---

## Phase 7 — Function Pages (Week 10)

### S50 — Cashier Pages
- **Security:** Amount field read-only; dispute required for discrepancies

### S51 — Shop Buyer Pages
- **Security:** Receipt image required; edit only before confirm

### S52 — Stock Pages
- **Security:** No cost prices for stock assistant; dispatch atomic

### S53 — Sales Pages
- **Security:** Below-price triggers approval; no warehouse in printed receipt

### S54 — Manager Pages
- **Security:** Branch-scoped; advance limit enforced; bonus approval required

---

## Phase 8 — Customization (Week 11)

### S55 — Custom Categories + Units
- **Security:** Per-company isolation; only employer can add

### S56 — Custom Fields
- **Security:** Field names validated (no injection); per-company

### S57 — Feature Toggles
- **Security:** Backend checks toggle before allowing API; frontend respects toggle

### S58 — Multi-Currency
- **Security:** Formatting only — no monetary value change

### S59 — Custom Receipt Template
- **Security:** Logo upload MIME-checked + sanitized SVG

---

## Phase 9 — Offline/LAN (Weeks 12–13)

### S60 — Local Server Setup
- **Security:**
  - Same JWT secret as cloud
  - LAN TLS (self-signed cert or local CA)
  - Physical network isolation recommended

### S61 — Sync Engine (Push)
- **Security:**
  - Every sync request signed with HMAC
  - Unique sync ID + 5-min expiry (replay protection)
  - TLS 1.3 mandatory
  - Retry with exponential backoff (not DDoS)
- **Done when:** Tampered sync rejected

### S62 — Conflict Resolution
- **Security:** Never overwrite cloud audit log; never delete; manual review for ambiguous

### S63 — Offline UI
- **Security:** "Pending sync" count visible; sync errors surfaced (not silent)

---

## Phase 10 — DevOps + Launch (Week 14)

### S64 — Docker + Nginx + SSL
- **Internet:** ✅ (Let's Encrypt)
- **Security:**
  - TLS 1.3
  - HSTS
  - Rate limiting at Nginx
  - Non-root container user
  - Secrets via env (not baked into image)

### S65 — Backups + Monitoring
- **Internet:** ✅ (Sentry, UptimeRobot signup)
- **Security:**
  - Encrypted backups (GPG)
  - Offsite storage
  - Sentry PII scrubbing
  - Winston rotation (no disk full)

### S66 — Test Suite
- **Internet:** ❌
- **Security:**
  - Auth bypass tests
  - Cross-tenant data leak tests
  - Injection tests (SQL/NoSQL/XSS)
  - Rate limit tests
  - Branch isolation tests
- **Done when:** All security tests pass

### S67 — Deploy to Production
- **Internet:** ✅
- **Security:**
  - Environment audit
  - SSL verify
  - Firewall rules
  - Fail2ban configured
  - Secrets in vault (not `.env` on disk in prod)

### S68 — Documentation + Training
- **Internet:** ❌
- **Security:**
  - Document incident response
  - Document escalation paths
  - No credentials in docs

---

## Security Milestones

| Milestone | Segments | Criteria |
|---|---|---|
| **Auth working** | S14 | Login, JWT, refresh, role checks |
| **Multi-tenant proven** | S15, S16 | Attempt cross-tenant → 403 |
| **Audit active** | S27 | Every write logs |
| **Integration secure** | S29, S30 | API keys guarded, webhooks verified |
| **Frontend secured** | S32 | No tokens in URL, XSS-safe |
| **Branch isolation** | S17–S26 | Manager can't see other branch |
| **Offline secured** | S61 | HMAC on sync, TLS enforced |
| **Production hardened** | S64, S67 | SSL, HSTS, fail2ban |

---

**End of segment roadmap.**