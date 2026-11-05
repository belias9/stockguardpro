# Company setup: local wired network and online access

This guide explains the deployment choices for StockGuardPro and what the current code supports. Read the limitations in section 7 before using real company records: local-to-cloud sync exists in the code, but it is not a complete, verified two-way synchronization system.

## 1. How the parts fit together

StockGuardPro has three separate pieces:

1. **Frontend**: the pages staff use, in `frontend/`.
2. **Backend**: the Node.js API and Socket.IO service, in `backend/`.
3. **Database**: MongoDB, either on the branch server or hosted (for example, MongoDB Atlas).

The backend listens on port `5000` by default. The backend does not currently serve the frontend files itself. For local-network access, serve the frontend on the branch LAN and configure it to route `/api` and Socket.IO traffic to the branch backend, or use a reverse proxy that serves the frontend and forwards those paths. The frontend's current default uses same-origin `/api` outside localhost; simply opening a separately hosted website will therefore use that website's origin, not automatically discover a branch server.

## 2. Choose an operating model

### Model A: Online company system

All staff use the hosted HTTPS website and cloud API. The cloud API connects to one production MongoDB database. This is the simplest model when every location has reliable internet.

### Model B: Local-only branch system

Each branch uses a computer on its wired LAN as its server. That computer runs the backend in `local` mode and MongoDB locally. Staff on the same LAN access it through the branch network. Internet is not required for local requests, but online services such as WhatsApp, external AI, and cloud sync are unavailable without internet.

### Model C: Branch LAN plus cloud (hybrid)

Each branch runs its own local backend and database. Branch staff use that local system; a sync worker attempts to send supported queued records to the cloud when the internet is available. The cloud can host central access and reporting, subject to the sync limitations below.

Do not assume that a hybrid branch is automatically failover-connected to the cloud. The application must be deliberately configured so that the frontend at that branch talks to that branch's LAN backend.

## 3. Prepare a branch server for wired LAN access

Use a dedicated, supported Windows or Linux computer with a fixed/reserved LAN IP address. Keep it physically secure and on a UPS if business continuity matters. Install Node.js 22.3 or newer, MongoDB 6 or newer, and Git. For production, have an administrator maintain the operating system and database.

1. Check out the approved StockGuardPro release onto the server. Do not use a developer's personal working copy for production.
2. In `backend/`, install dependencies with `npm install`.
3. Copy `backend/.env.example` to `backend/.env` and edit it. Never commit or share `.env`.
4. Set at minimum:

   ```dotenv
   NODE_ENV=production
   PORT=5000
   APP_MODE=local
   BRANCH_ID=<the branch's database ID>
   MONGODB_URI_LOCAL=mongodb://127.0.0.1:27017/stockguardpro_<branch>
   JWT_SECRET=<unique-long-random-secret>
   JWT_REFRESH_SECRET=<different-unique-long-random-secret>
   CLIENT_URL=<the exact origin used by the branch frontend>
   ```

   Create a distinct strong `SYNC_SECRET` for hybrid deployments and set the same value on the trusted cloud receiver. Keep secrets private and different for each environment. The branch ID must be a real branch record ID recognized by this installation; do not copy the placeholder literally.
5. Start MongoDB, then run `npm run start:local` from `backend/`. This invokes `backend/server-local.js`, which requires `BRANCH_ID` and sets local mode. Confirm `http://127.0.0.1:5000/api/health` on the server.
6. Configure a frontend web server or reverse proxy on the LAN. Serve the contents of `frontend/` and route `/api` and `/socket.io` to `http://127.0.0.1:5000`, including WebSocket upgrades for Socket.IO. Set `CLIENT_URL` to the frontend origin (for example `http://branch-app.company.lan`). The proxy should be the only network path to the app; do not expose MongoDB to staff devices.
7. Configure DNS or a router reservation so the server address does not change. On the firewall, permit only the required frontend port from the company LAN. Keep backend port 5000 and MongoDB port 27017 inaccessible from public networks; ideally allow backend access only from the reverse proxy.
8. On a second staff computer connected by Ethernet to the same trusted LAN, open the frontend URL and verify login, branch selection, page access and a test receipt. Test Socket.IO updates too. Confirm `/api/health` through the proxy.

The current browser configuration expects the API and socket to share the frontend origin for non-localhost hosts. A reverse proxy is the recommended way to satisfy that expectation. Directly opening an HTML file or using a static website host without an API proxy will not connect to the branch API correctly.

## 4. Set up the cloud system

1. Provision a production Node.js host that supports long-running Node processes, HTTPS, and WebSocket upgrades. Provision a production MongoDB database with TLS and a least-privilege database account. Do not expose MongoDB publicly without strict network controls.
2. Deploy the backend release and frontend. Use a reverse proxy so website, `/api`, and `/socket.io` use one HTTPS domain when possible. Configure host CORS to allow only the exact website origin.
3. Configure the cloud backend environment, at minimum:

   ```dotenv
   NODE_ENV=production
   APP_MODE=cloud
   PORT=5000
   MONGODB_URI=<production-database-connection-string>
   JWT_SECRET=<unique-long-random-secret>
   JWT_REFRESH_SECRET=<different-unique-long-random-secret>
   CLIENT_URL=https://app.example.com
   WEBAUTHN_RP_ID=app.example.com
   WEBAUTHN_ORIGIN=https://app.example.com
   ```

   Use the actual domain you own. Set secrets in the host's secret manager, not in frontend code or source control.
4. Ensure uploads (company logo, policy files and other uploaded assets) use durable, access-controlled storage with backups. A host's temporary local disk may be erased during deploys.
5. Configure TLS/HTTPS, database backups, monitoring, log retention, firewall rules, and a documented restore procedure before adding real company data.
6. Create the initial employer account using the application's approved onboarding/seed process. The first employer should set company details and branches, then create separate named accounts for staff. Do not share one employer login among workers. Check whether the current release provides a safe production bootstrap process before opening registration.
7. Verify the cloud site through its HTTPS URL and test with non-production records before launch.

## 5. Configure hybrid local-to-cloud sync

Hybrid deployment requires a local branch database and a separate cloud database. The branch server's `.env` needs:

```dotenv
APP_MODE=local
BRANCH_ID=<real-branch-id>
MONGODB_URI_LOCAL=mongodb://127.0.0.1:27017/stockguardpro_<branch>
CLOUD_API_URL=https://api.example.com/api
SYNC_ENABLED=true
SYNC_INTERVAL_MS=30000
SYNC_SECRET=<long-random-secret-shared-only-with-cloud-sync-receiver>
```

The cloud API must be deployed with a matching `SYNC_SECRET` and the `/api/sync/receive` endpoint reachable over HTTPS. The local worker checks that endpoint and tries pending queue items every 30 seconds when configured. `CLOUD_API_URL` should include `/api`, because the worker posts to `${CLOUD_API_URL}/sync/receive` and checks `${CLOUD_API_URL}/health`.

Before connecting production databases, use a disposable test company and branch. Disconnect/reconnect the internet, check pending/synced/failed/conflict counts on the sync status page/API, force retries, and compare source and destination records. Document who resolves conflicts and how to restore from backup.

## 6. Security, backups and who administers it

- The company's designated primary employer owns company configuration, user access, role assignments, and business approvals within the scope implemented by the app. A system/IT administrator separately manages servers, domains, software updates, backups, integrations and secrets. Those responsibilities can belong to different people.
- Give each person an individual account and the minimum role/branch access needed. Remove accounts promptly when staff leave. Review employer and manager access regularly.
- Use HTTPS for cloud and any LAN use that crosses untrusted devices/networks. Use a private, segmented business LAN for local-only HTTP; never forward app or MongoDB ports from the router to the public internet.
- Keep MongoDB bound to localhost on the branch server unless a controlled architecture requires otherwise. Encrypt and restrict backups; test restoring them. A backup that has never been restored is not a verified recovery plan.
- Store API keys only on the backend or in a secret manager. Rotate compromised or departing-admin credentials. Do not log passwords, bearer tokens, payment details, or biometric data.
- Configure allowed website origins, OS updates, firewall rules, antivirus/endpoint protection, audit retention, and an incident contact. Use separate staging and production databases.
- The app's security controls do not guarantee that a deployment is “100% secure.” Have a qualified administrator review the hosting, permissions, backup and incident plan before production use.

## 7. Current limitations to understand before going live

- Local/cloud sync is a code path for queued writes, not a demonstrated full two-way database replica. The receiver only maps selected record types (inventory, receipts, withdrawals, attendance, salary, pre-records, customers/orders, cashier sessions and inventory audits). It does not prove that all app data, users, settings, reference data, or cloud changes flow back to branches.
- The code shown for sync applies create/update/delete operations against the cloud models, but production correctness depends on IDs, tenant/branch mapping, duplicate handling, constraints, and conflict policy. Validate these in a staging database. Do not treat sync as a backup.
- The project does not provide a complete turnkey production deployment for LAN web serving or reverse proxy. Configure and test that layer as described above.
- External integrations such as WhatsApp, OpenAI, email, passkeys on a public domain, and cloud sync require their respective credentials, HTTPS/public callbacks where applicable, and internet access.
- Capacitor packages a frontend as a mobile app; it does not replace the backend or database. Phones on the company LAN still need a reachable backend URL and properly configured HTTPS/network policy for production use.

## 8. Go-live checklist

- [ ] Pick online-only, local-only, or hybrid for each branch and document the design.
- [ ] Use separate staging and production environments and test with fake records.
- [ ] Set unique secrets; confirm none are in Git or frontend assets.
- [ ] Confirm local clients can reach only the intended branch, and cloud clients use HTTPS.
- [ ] Confirm MongoDB is not public and database users have limited permissions.
- [ ] Test critical workflows: receipt, stock movement/approval, payment confirmation, attendance, salary approvals, role permissions and reports.
- [ ] Test internet outage and recovery for each hybrid branch; inspect sync discrepancies manually.
- [ ] Configure backups, restore test, disk monitoring, logs and responsible on-call contact.
- [ ] Train the primary employer and a separate technical administrator; record integration owners and credential rotation steps.
- [ ] Do not switch to real company records until all checks relevant to the chosen operating model pass.

## 9. Existing detailed guides

- `HOSTING-AND-CAPACITOR.md` — hosted website and Capacitor packaging.
- `INTEGRATION-SETUP.md` — AI, WhatsApp, attendance hardware, uploads, and integration caveats.
- `SYSTEM-MAINTENANCE.md` — ongoing administration and maintenance.
- `TESTING-GUIDE.md` — workflow verification.
