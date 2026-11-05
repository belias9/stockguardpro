# StockGuardPro integration setup

This guide separates integrations that already have code from integrations that still need implementation or production credentials. Do not put API keys in frontend JavaScript, commit them, or share them with employees. Store secrets in `backend/.env` or a secrets manager and rotate any key that has been exposed.

## 0. Accounts and websites to prepare

You do not need every account to run the app locally. Create only the accounts for features you plan to enable. Use the official sites below; menu names can change, so follow the provider's current setup guide if a dashboard label differs.

| What you need | Sign in / create account | What you get and where it goes | Needed when |
|---|---|---|---|
| Node.js for the server | [nodejs.org/en/download](https://nodejs.org/en/download/) | Install the LTS release on the computer or host running the backend. This is software, not an API key. | Always, unless using a managed Node host that supplies it. |
| Git repository for deployment | [github.com](https://github.com/) | Put the project in a private repository, then authorize your hosting provider to access it. Never commit `.env`, API keys, database passwords or customer data. | For the Git-based hosting example below. |
| Online database | [MongoDB Atlas](https://www.mongodb.com/atlas/database) and [Atlas connection guide](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/) | Create a cluster, database user and network access rule. Copy the app's driver connection string into backend `MONGODB_URI`. Use a restricted database user and allow only the backend host's outbound IP where possible. | Online/cloud deployment. Local MongoDB needs no Atlas account. |
| Website/API hosting | [Render](https://render.com/) and [Node/Express deployment guide](https://render.com/docs/deploy-node-express-app) | Create a Node web service for `backend/` and a static site for `frontend/`, or use another host with persistent processes, HTTPS, environment secrets, WebSockets and persistent/object storage. Add backend variables from `.env.example` in the host's secret settings. | Public online use. Render is an example, not a required provider. |
| Domain and DNS (optional) | [Cloudflare dashboard](https://dash.cloudflare.com/) or your domain registrar | Buy/register a domain with a registrar, then configure DNS to point to the website host. Set the exact public frontend origin in backend `CLIENT_URL` and set WebAuthn relying-party values to the HTTPS hostname. Cloudflare is optional. | A custom address such as `app.yourcompany.com`; a host-provided URL can be used first. |
| AI features | [OpenAI Platform](https://platform.openai.com/) and [API key setup](https://developers.openai.com/api/docs/quickstart) | Create a project and a restricted API key; set usage limits/budget controls. Store it as backend `OPENAI_API_KEY` and select a supported model with `OPENAI_MODEL`. API billing is separate from a ChatGPT subscription. | AI assistant, applicant document suggestions and WhatsApp analysis. |
| WhatsApp messaging/webhook | [Meta for Developers](https://developers.facebook.com/) and [WhatsApp Cloud API getting started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/) | Create a Meta developer app, add WhatsApp, set up a Meta Business Portfolio and business phone number. Copy the Phone Number ID, access token and Business Account ID into `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_BUSINESS_ACCOUNT_ID`. Create your own random `WHATSAPP_VERIFY_TOKEN`, enter the same value in Meta's webhook setup, and put the app secret in `WHATSAPP_APP_SECRET`. | WhatsApp send/receive/webhook functions. Meta approval, templates and customer opt-in may be required. |
| Android app build and distribution | [Android Studio](https://developer.android.com/studio) and [Google Play Console](https://play.google.com/console/) | Android Studio is used to build/sign the Android app. A Play Console developer account is needed only to publish through Google Play; private APK distribution does not require Play publishing. | Capacitor Android build; Play Console only for store publishing. |
| iPhone app build and distribution | [Apple Developer](https://developer.apple.com/programs/) and [Apple enrollment help](https://developer.apple.com/help/account/) | Xcode on a Mac builds/signs iOS apps. Apple Developer Program enrollment is needed for normal App Store distribution. | Capacitor iOS build; requires access to a Mac. |

### Do not create these integration accounts yet

- **Email delivery:** password reset and verification mail are not wired to a provider. There are no email API/SMTP environment fields in the current app. Once the email service is implemented, choose a transactional email provider, create its account, verify a sender domain, and add its server-side credentials.
- **Payment gateway:** the app records payment methods and confirmations, but it does not yet connect to a payment processor. Do not request gateway keys until a provider and payment workflow are implemented.
- **Fingerprint terminal:** a generic USB reader has no universal web API. Choose the exact terminal/vendor first; then obtain its SDK/API access from that vendor and implement its authenticated device connector. Phone passkeys use the phone/browser and do not require a biometric vendor API.
- **Automatic WhatsApp group reading:** Meta account access alone does not guarantee that WhatsApp will deliver group events to this app. Verify that the selected account/product and groups are supported before relying on group analysis. The app only analyzes verified events delivered to the configured webhook.

### Recommended order

1. Run locally with Node.js and a local MongoDB instance; no external API accounts are required.
2. For online hosting, create the private Git repository, MongoDB Atlas database, host account, and HTTPS domain. Deploy and test with fake records first.
3. Add OpenAI only if you want AI features; set a spending limit and use non-sensitive test data.
4. Add Meta WhatsApp only after the webhook is reachable over HTTPS and you have tested the exact phone number, templates and message events.
5. Create Google Play or Apple developer accounts only when you are ready to package, sign and distribute the Capacitor app.

Provider account creation, verification and billing are handled by those providers. Do not paste their passwords, secret keys, access tokens, or full MongoDB connection string into this document or a chat.

## 1. Local application

1. Install Node.js 22.3 or newer and MongoDB 6 or newer (or create a MongoDB Atlas cluster).
2. From `backend`, install packages with `npm install`.
3. Copy `.env.example` to `.env`; set a database URI and two different random secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET` (at least 32 random characters each).
4. Start MongoDB, then run `npm run dev` from `backend`.
5. Serve `frontend/` from a local web server such as VS Code Live Server. The default local API and Socket.IO address is `http://localhost:5000`.
6. Check `GET /api/health` and confirm a test company can sign in before connecting external services.

Never use default secrets or development CORS settings in production. Deploy frontend and API behind HTTPS on the same trusted origin where possible. Configure `CLIENT_URL` for the real frontend origin.

## 2. MongoDB

For local operation, set `MONGODB_URI=mongodb://localhost:27017/stockguardpro`. For Atlas, create a database user with only the permissions required by this app, allow only the deployment's outbound IP addresses, enable TLS, and put the connection string in the backend environment. Back up the database and test restoring a backup before using real business records.

## 3. OpenAI assistant (optional)

The backend AI service reads `OPENAI_API_KEY` and `OPENAI_MODEL`. Create a restricted project key in the OpenAI platform, set it only in the backend environment, and restart the API. Confirm the app's AI feature is enabled and test with non-sensitive inventory data. Do not send customer secrets, employee biometrics, authentication tokens, or cost data unless the service has been explicitly designed and approved to handle them. AI responses are suggestions; users must verify them.

## 4. WhatsApp Cloud API (optional)

The backend expects Meta WhatsApp Cloud API credentials in `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, and optionally `WHATSAPP_BUSINESS_ACCOUNT_ID`.

1. Create a Meta Business app and add WhatsApp; register and verify a business phone number.
2. Configure a long-lived access token with the minimum messaging permissions needed and store it only on the server.
3. Set a strong random `WHATSAPP_VERIFY_TOKEN` and the matching Meta webhook verify token.
4. Expose the HTTPS API callback `/api/whatsapp/webhook`; during local development use a temporary HTTPS tunnel.
5. Subscribe the webhook to message events and configure the Meta app secret so the backend can verify `X-Hub-Signature-256`.
6. Test inbound and outbound messages with approved test numbers and templates. WhatsApp business-initiated messages may require an approved template and customer opt-in.

The webhook currently verifies and logs incoming message events. Review the WhatsApp service and webhook handler before expecting inbound conversations to appear in the in-app customer/message pages; event ingestion is not the same as a finished inbox integration.

## 5. Email and password recovery

Password reset and verification flows need a configured email provider. The current environment example has no SMTP/provider settings, so configure an approved transactional email service, add server-only credentials and sender identity, then wire and verify delivery in `backend/utils/emailService.js`. Test expiry, invalid tokens, rate limits, and non-enumerating responses before production.

## 6. Attendance hardware

Employee phones support WebAuthn passkey enrollment and attendance. Set `WEBAUTHN_RP_ID` to the production site hostname and `WEBAUTHN_ORIGIN` to its exact HTTPS origin. The phone OS may verify with fingerprint, face unlock, PIN, or device passcode; the website never gets the biometric itself. Local development derives its expected origin from the browser request.

Physical biometric terminals can be registered as `biometric_reader`. Integrate the manufacturer's trusted SDK/agent to call `/api/attendance/device-event` over HTTPS with the device ID, one-time API key, employee ID, event ID, event type, and capture timestamp. Configure a specific branch before registering. The terminal/vendor must authenticate its own match and must protect the API key. Do not send raw biometric templates to this app.

For WhatsApp group analysis, configure the Meta webhook URL and app secret, then in employer Settings provide the provider phone-number ID and exact monitored group IDs. The webhook only processes verified incoming events that explicitly include a group ID and whose number/group are configured. Provider group delivery support varies by account/product; the app cannot make WhatsApp deliver events the provider does not send. Tell participants before enabling monitoring.

Applicants may upload PDF, DOCX, or TXT files (up to four, 4 MB each). The backend extracts text in memory; it does not retain downloadable copies. Configure AI only after reviewing privacy and retention requirements.

## 7. Offline branch sync

The project queues writes from selected branch models and pushes them to the cloud. Set `APP_MODE=local`, `BRANCH_ID`, `MONGODB_URI_LOCAL`, `CLOUD_API_URL` (including `/api`), and the same unique `SYNC_SECRET` (32+ characters) on both the branch and cloud server. Sync is one-way branch-to-cloud, not a two-way replica; conflicts need human review, and other models such as user accounts/company settings are not synchronized. Validate supported workflows using disposable data before enabling production sync. See `ACCOUNTING-LEDGER-AND-RECOVERY.md` for scope and recovery instructions.

## 8. Logo and receipt printing

The employer settings page provides a logo upload endpoint and a generated-logo action. Configure persistent, access-controlled upload storage and backups before deployment; local ephemeral disk is not durable cloud storage. Receipt printing uses a browser print window and the company's saved template. Test paper size, logo availability, escaping of customer/item data, and print output on the actual printer.

## 9. Production checklist

- HTTPS, secure CORS allowlist, secure secrets, rate limits, and least-privilege database credentials.
- Separate production database, automated backups, and a verified restore procedure.
- Verify each role and branch boundary using accounts with deliberately different access.
- Configure log retention and alerting without logging tokens, passwords, biometric templates, or payment credentials.
- Document who owns each integration credential and how to revoke/rotate it.
- Keep integrations disabled until their credentials, webhook signatures, permissions, and failure handling have been verified.

## 10. What runs automatically today

- Attendance records with no clock-in are marked absent by a daily server cron job. This currently runs at 23:59 in the server's timezone; it does not use each company's configured report time.
- A monthly cron job only writes a reminder to the server log to generate salaries. It does not calculate or pay salaries automatically.
- AI pages provide user-requested assistance. They do not autonomously contact customers or act as a salesperson.
- The WhatsApp webhook verifies/logs events, but messages are not yet synchronized into the in-app inbox. Receipt WhatsApp buttons open a manually addressed WhatsApp conversation; they do not send unattended messages.
- Attendance is marked absent by a daily server cron. End-of-day reports are generated per active branch after the saved company-local report time, stored as immutable reports, and announced over the in-app socket channel. Email/WhatsApp delivery of those reports is not automatic yet.
- AI applicant suggestions and WhatsApp message analysis need `OPENAI_API_KEY`; without it, the app stores an explicit unavailable result. AI never approves hires or executes actions.
- Company documents can be uploaded as private PDF/JPEG/PNG attachments and downloaded through an authenticated, company-scoped route. Applicant PDFs, DOCX, and TXT files are text-extracted in memory and are not retained as files.
- The primary employer controls co-employer scopes within one company. Shareholder data records ownership and voting percentages, but does not implement statutory voting, shareholder signatures, or a holding company spanning separate company tenants.
