# StockGuardPro — Security Architecture

> **Top priority.** Every design decision defaults to "deny" unless explicitly allowed.
> Security is enforced at 3 layers: menu, router, API. Backend is the final authority.

---

## 1. Security Principles

| Principle | Meaning |
|---|---|
| **Defense in depth** | Multiple layers must all fail for breach |
| **Least privilege** | Every role has only what's needed |
| **Zero trust** | Every request re-verified, even from authenticated users |
| **Fail closed** | Errors → deny access, not allow |
| **Immutable audit** | Logs cannot be altered after write |
| **No secrets in code** | Only via env + vault |
| **Encrypt at rest and in transit** | TLS 1.3, hashed passwords |
| **Never trust client input** | All inputs validated server-side |

---

## 2. Authentication

### Password Auth
- bcrypt with **12 rounds**
- Minimum 8 characters (enforced at registration)
- No password in logs, no password in responses

### JWT
- Access token: 7 days, in `Authorization: Bearer` header
- Refresh token: 30 days, httpOnly cookie (recommended for prod)
- Signed with `JWT_SECRET` (32+ chars)
- Contains: `userId`, `companyId`, `role`, `activeRoles`, `branch`
- **Never contains:** password, PII, sensitive data

### Refresh Token Rotation
- Every refresh issues a new refresh token
- Old token invalidated
- Detects token theft (reuse of old token → lock account)

### Session Management
- Store `lastLogin` on user
- Log all login attempts (success + fail)
- **5 failed attempts → 15 min lockout**
- Notify user of new login from unfamiliar IP (optional, future)

### Multi-Factor (Optional per employer)
- Employer can require 2FA for their account
- TOTP (Google Authenticator) — recommended
- Not mandatory, but highly recommended for employer accounts

---

## 3. Authorization

### Layer 1: Menu (Frontend)
- Items the user can't use → hidden
- `menuConfig.js` built from role + activeRoles + branch

### Layer 2: Router (Frontend)
- `accessMap.canAccess(page)` checked before page renders
- Direct URL → redirect to dashboard
- **This is UX only, NOT security**

### Layer 3: API (Backend) — THE REAL AUTHORITY
- Every route protected by `protect` (JWT verify)
- Every route adds `authorize(...)` or `authorizeFunction(...)`
- Every route adds `authorizeBranch(...)`
- Every query adds `{ company: req.user.company }`
- Every branch-scoped query adds `{ branch: req.branch }`

**Rule:** If a frontend route is bypassed (DevTools, curl), backend still blocks.

---

## 4. Multi-Tenant Isolation

### Hard rule
Every database query must scope by `company`.

```js
// ALWAYS:
User.find({ company: req.user.company, ... })

// NEVER:
User.find({ ... })  // missing company
 
---
## 5. input validation:

### Response Sanitization (Financial)
- Profit and cost fields stripped from API responses based on role
- Enforced in serializer level, not route level
- Cashier, Stock (assist), Sales, Shop Buyer: no cost/profit ever
- Every response passes through role-based sanitizer

---
## 6. common attack defenses:
### Data Leakage (Financial)
- ✅ Response sanitizer strips cost/profit from unauthorized roles
- ✅ No cost data in any cached response
- ✅ No cost data in any frontend bundle
- ✅ No cost data in API error messages
- ✅ Logs never contain cost amounts