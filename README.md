# GrowthMonk Messaging Adapter

GrowthMonk's own messaging system for receiving, responding to, and routing
customer enquiries from owned business messaging channels.

The first version is wired only to GrowthMonk's own WhatsApp Business number.
The architecture is modular so additional GrowthMonk-owned channels (Instagram,
Facebook Messenger) can be added later without changing the core flow.

---

## 1. What this app does

- Receives inbound WhatsApp messages sent to GrowthMonk's owned WhatsApp
  Business number via the WhatsApp Cloud API.
- Sends replies back through the WhatsApp Cloud API.
- Logs message metadata as structured JSON with secrets redacted.
- Detects opt-out, human-handoff, and hot-lead keywords in GrowthMonk customer
  conversations.
- Optionally forwards each inbound message to a bot endpoint and replies with
  the bot's response; falls back to a polite human-handoff acknowledgement if
  the bot is unavailable.
- Optionally pings a Telegram chat when a hot lead or human-handoff request
  comes in.
- Is structured for future channel expansion (Instagram, Messenger) using the
  same normalized internal message model.

This is GrowthMonk's own messaging system. It is not designed as a third-party
platform and does not handle messaging for any other business.

---

## 2. Railway deployment

1. Push this repository to GitHub.
2. In Railway, create a new project from the repository.
3. Railway auto-detects Node via Nixpacks; the included `railway.json` pins
   `npm start` as the start command and `/health` as the health check.
4. Add the environment variables from section 3 in Railway's *Variables* tab.
5. Deploy. Railway will assign a public HTTPS URL such as
   `https://growthmonk-messaging-production.up.railway.app`.
6. Use `https://<your-railway-domain>/webhooks/whatsapp` as the Meta callback
   URL (see section 4).

---

## 3. Environment variables

Copy `.env.example` to `.env` for local development. Set the same variables in
the Railway dashboard for production.

| Name | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | no | `development` or `production`. Defaults to `development`. |
| `PORT` | no | HTTP port. Railway injects this automatically. Defaults to `3000` locally. |
| `LOG_LEVEL` | no | pino log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`). Defaults to `info` in production, `debug` otherwise. |
| `VERIFY_TOKEN` | **yes** | Token used in the Meta webhook verification handshake. Choose a long random string and paste the same value into the Meta developer console. |
| `WHATSAPP_TOKEN` | **yes** | Permanent system-user token for GrowthMonk's WhatsApp Cloud API access. |
| `PHONE_NUMBER_ID` | **yes** | Phone Number ID of GrowthMonk's owned WhatsApp business number. |
| `WABA_ID` | **yes** | GrowthMonk's WhatsApp Business Account ID. |
| `META_APP_SECRET` | no | Meta App Secret. When set, every inbound webhook is verified via the `X-Hub-Signature-256` HMAC header. |
| `INTERNAL_API_KEY` | **yes** | Required on the `/send-test` endpoint via the `x-api-key` header. |
| `BOT_API_URL` | no | If set, inbound messages are forwarded here and the bot's `reply` is sent back to the customer. |
| `TELEGRAM_BOT_TOKEN` | no | Used together with `TELEGRAM_CHAT_ID` to send alerts on hot leads / handoffs. |
| `TELEGRAM_CHAT_ID` | no | Telegram chat that receives the alerts. |

Secrets are never logged. The pino logger redacts `authorization`, `cookie`,
`x-api-key`, `x-hub-signature-256`, `WHATSAPP_TOKEN`, `VERIFY_TOKEN`,
`META_APP_SECRET`, `INTERNAL_API_KEY`, and `TELEGRAM_BOT_TOKEN` from log output.

---

## 4. Meta webhook setup

In the Meta App dashboard (the app associated with GrowthMonk's owned WhatsApp
Business Account):

1. Open **WhatsApp → Configuration → Webhook**.
2. Click **Edit**.
3. **Callback URL**: `https://<your-railway-domain>/webhooks/whatsapp`.
4. **Verify token**: the value you set in `VERIFY_TOKEN`.
5. Click **Verify and save**. The app should respond with the challenge
   string; a log line `WhatsApp webhook verification succeeded` confirms it
   server-side.
6. Subscribe the webhook to the `messages` field.
7. (Optional but recommended) Copy the **App Secret** from the Meta app's
   *Basic* settings into the `META_APP_SECRET` env var so the app starts
   validating Meta's `X-Hub-Signature-256` on every delivery.

---

## 5. Local development

```bash
cp .env.example .env
# fill in VERIFY_TOKEN, WHATSAPP_TOKEN, PHONE_NUMBER_ID, WABA_ID, INTERNAL_API_KEY
npm install
npm run dev
```

To expose the local server to Meta for testing, use a tunnel such as
`ngrok http 3000` and put the resulting HTTPS URL in the Meta webhook config.

---

## 6. Test curl commands

Health check:

```bash
curl -s https://<your-railway-domain>/health
```

Send a test WhatsApp message through GrowthMonk's owned number (replace the
recipient with a number that has already opted in to receive messages from
GrowthMonk's number — outside of the 24-hour customer service window, the
WhatsApp Cloud API requires an approved template):

```bash
curl -s -X POST https://<your-railway-domain>/send-test \
  -H "Content-Type: application/json" \
  -H "x-api-key: $INTERNAL_API_KEY" \
  -d '{"to":"971XXXXXXXXX","body":"Test message from GrowthMonk messaging adapter"}'
```

Simulate the Meta verification handshake locally:

```bash
curl -s "http://localhost:3000/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=hello"
# -> hello
```

---

## 7. Privacy and data handling

- This service receives customer messages sent to GrowthMonk's owned WhatsApp
  Business number.
- Those messages are used to respond to enquiries, route GrowthMonk customer
  conversations, and support demo / appointment / pricing requests.
- GrowthMonk does not sell customer data.
- Secrets (API tokens, signing keys, internal API keys, cookies, authorization
  headers) are redacted from logs.
- Opt-out keywords (`stop`, `unsubscribe`, `cancel`) are respected: the user
  receives a single confirmation reply and no further non-essential messages
  are sent.
- Inbound message IDs are deduplicated in-memory to avoid double-replying to
  Meta retries.

---

## 8. Troubleshooting

**Webhook verification fails (`403 Forbidden` from `/webhooks/whatsapp`)**
- Confirm `VERIFY_TOKEN` in Railway matches the verify token entered in the
  Meta dashboard exactly (no trailing whitespace).
- The server log will show `WhatsApp webhook verification failed`.

**`401 Invalid signature` on inbound webhooks**
- `META_APP_SECRET` is set but doesn't match the Meta app's actual App Secret.
- Either correct the value or unset `META_APP_SECRET` to disable signature
  verification temporarily.

**`WHATSAPP_TOKEN` expired**
- Tokens issued from a Meta user account are short-lived. Replace with a
  permanent System User token associated with GrowthMonk's WhatsApp Business
  Account and redeploy.

**`PHONE_NUMBER_ID` wrong / `4xx` from `/messages`**
- The Phone Number ID must belong to the same WhatsApp Business Account
  (`WABA_ID`) as the token. Confirm both in the Meta dashboard.

**`4xx` from the WhatsApp API on outbound sends**
- The recipient may be outside the 24-hour customer service window; an
  approved message template is required to message them first.
- The recipient phone number must be in E.164 digits only (e.g.
  `971501234567`). The service strips non-digits automatically.
- Check the structured log entry — Meta's `error` object is logged verbatim
  (without the auth header).

**Railway env vars missing**
- The process refuses to start and logs `Missing required environment
  variable: <NAME>`. Set the variable in the Railway dashboard and redeploy.

**Messages aren't being received at all**
- Confirm the Meta webhook is subscribed to the `messages` field.
- Confirm Railway is healthy: `GET /health` should return `status: "ok"`.
- Confirm the deployed URL ends with `/webhooks/whatsapp`.

---

## Project layout

```
src/
  server.js                              # Process bootstrap, graceful shutdown
  app.js                                 # Express app wiring
  config/
    env.js                               # Loads + validates environment variables
    logger.js                            # pino logger with secret redaction
  routes/
    health.js                            # GET /health
    whatsappWebhook.js                   # GET + POST /webhooks/whatsapp
    sendTest.js                          # POST /send-test (internal)
  services/
    whatsappService.js                   # Graph API v25.0 sender with retry
    botService.js                        # Optional outbound to bot endpoint
    telegramService.js                   # Optional Telegram alerts
    signatureService.js                  # X-Hub-Signature-256 verification
    leadDetectionService.js              # Opt-out / handoff / hot-lead matchers
  repositories/
    messageRepository.js                 # In-memory message-id dedupe
    optOutRepository.js                  # In-memory opt-out registry
  middleware/
    requestLogger.js                     # pino-http request log
    errorHandler.js                      # Central error handler + 404
    rateLimiter.js                       # express-rate-limit instances
  adapters/
    whatsappAdapter.js                   # Parse + process WhatsApp events
    instagramAdapter.placeholder.js      # Reserved for future expansion
    messengerAdapter.placeholder.js      # Reserved for future expansion
```
