# Internet Requirements — Per Segment

**Rule of thumb:** Only integrations and deployment need internet. All coding works offline.

## Requires Internet

| Segment | What | When |
|---|---|---|
| **S01** | Download tools + `npm install` | Once |
| **S29** | OpenAI API calls | Every AI feature test |
| **S30** | WhatsApp API + webhook tunnel | Every WhatsApp test |
| **S64** | Let's Encrypt SSL | Once per deploy |
| **S65** | Sentry, UptimeRobot signups | Once |
| **S67** | Deploy to VPS | Once |

## Optional Internet

| Segment | What | Notes |
|---|---|---|
| **S02** | MongoDB Atlas | Only if using cloud. Local Mongo works offline. |

## Works Fully Offline

| Phase | Segments |
|---|---|
| Foundation | S03 |
| Models | S04–S13 |
| Services + Routes | S14–S27 |
| Socket.IO | S28 |
| Frontend Core | S31–S34 |
| Shared Pages | S35–S40 |
| Employer Pages | S41–S49 |
| Function Pages | S50–S54 |
| Customization | S55–S59 |
| Offline/LAN | S60–S63 |
| Tests | S66 |
| Docs | S68 |

## Strategy

**Batch plan around internet availability:**

1. **Good internet day:** S01 (download + npm install), S29 (test AI), S30 (test WhatsApp), S64–S67 (deploy)
2. **Unstable internet day:** All backend + frontend coding (S03–S28, S31–S63, S66, S68)
3. **Offline day:** Frontend coding, model design, tests

## Required Installs (Once)

- Node.js 18+ (LTS)
- MongoDB Community Server
- MongoDB Compass (GUI)
- Git
- VS Code + Live Server extension
- Postman (API testing)
- ngrok (WhatsApp webhook tunnel — S30 only)

## Environment Variables Requiring Internet

When you run these segments, the following env vars must be valid:
- `OPENAI_API_KEY` (S29)
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN` (S30)
- `MONGODB_URI` if using Atlas (S02 cloud option)
- `CLOUD_API_URL` (S61 sync)