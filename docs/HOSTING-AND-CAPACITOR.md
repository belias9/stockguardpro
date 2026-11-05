# Hosting StockGuardPro and packaging it with Capacitor

## Recommended first deployment: hosted website

StockGuardPro has a static frontend and a Node/Express API backed by MongoDB. Deploy them as separate services, or serve `frontend/` from the same HTTPS domain as the API.

1. Use Node.js 22.3 or newer for the current PDF and WebAuthn dependencies. Prepare a production MongoDB database and a restricted database user. Enable backups and test restoring one.
2. Deploy `backend/` to a Node.js host that supports persistent processes, environment variables, HTTPS, and WebSockets (Socket.IO). Set `MONGODB_URI`, strong unique `JWT_SECRET` and `JWT_REFRESH_SECRET`, `CLIENT_URL`, `NODE_ENV=production`, and any optional integration keys. Never place secrets in frontend files.
3. Deploy the contents of `frontend/` to a static web host. Configure the API base URL in `frontend/js/core/config.js` to the HTTPS API URL. Configure CORS on the API to allow only the real frontend origin.
4. Configure the host's health check to use `/api/health`, apply database migrations/index creation as required, and verify that the host supports persistent uploaded files or change uploads to object storage.
5. Create the first employer account, enable MFA if added by the deployment, set company/branch data, then create a separate non-admin account for daily work.
6. Verify login, branch scoping, receipt creation/printing, payment confirmation, stock transfers, backups, and restore using non-production data before launch.

Use the repository's Docker/Nginx configuration only after reviewing it against the production host. Do not publish MongoDB directly to the internet. Serve the site and API over HTTPS.

## Capacitor downloadable app

Capacitor packages the web frontend in a native Android/iOS shell; it does not host the backend or database. Keep the API deployed and reachable over HTTPS.

1. Install Node.js 22.3+, Android Studio for Android, and Xcode on macOS for iOS. Install Capacitor CLI and the Android/iOS platform packages in a separate mobile packaging project or the frontend project after reviewing dependencies.
2. Set the Capacitor web asset directory to the built/copied frontend. Add Android and/or iOS platforms, then sync the web assets and native plugins.
3. Point the app at the production HTTPS API. Do not embed backend secrets. Set a restrictive network security policy and app identifier, icons, splash screen, version, and signing credentials.
4. Use native camera plugins only with clear permission prompts and a privacy policy. Test camera capture, file upload, printing/share flows, login expiry, offline sync, and Socket.IO behavior on real devices.
5. Create signed Android App Bundle/APK or iOS archive with private signing credentials. Test an internal release before publishing through Google Play or Apple App Store review.

The current project does not include Capacitor configuration, native projects, store credentials, or a mobile build pipeline. Those are setup steps, not already delivered features. Capacitor also cannot supply raw fingerprint/Face ID templates to the current attendance API; use platform authentication/WebAuthn or a trusted biometric terminal integration.

## Hosting limitations to resolve

- Choose persistent/object storage for uploaded logos and images; many application hosts erase local disk on redeploy.
- Configure email delivery, WhatsApp credentials/webhooks, AI keys, monitoring, backups, retention, and an incident contact before production use.
- Confirm local timezone behavior for scheduled jobs and prevent duplicate cron execution when running multiple backend instances.
- Make a staging environment that uses fake data and separate credentials.
