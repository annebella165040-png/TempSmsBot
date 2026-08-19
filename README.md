# AnneBella Temp SMS Bot

A Node.js Telegram bot and installable web admin panel for managing Firebase-backed Indian virtual SMS numbers. The project stores users, credits, referrals, Firebase panels, gift cards, SMS log dedupe state, and admin data in PostgreSQL.

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/annebellamonk/New-repo-temp-otp-bot)
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https://github.com/annebellamonk/New-repo-temp-otp-bot)

## Features

- Telegram bot with force-join verification, premium emoji styling, small-caps button labels, and polling mode
- 100 free signup credits, 5-credit number purchases, 20-credit referral rewards, and 1000-credit web-panel access
- Automatic refund when a purchased number is cancelled before any live SMS arrives
- UPI QR credit purchase flow with user screenshot submission and owner approve/decline actions
- Password-protected admin panel at `/admin/login`, with PWA install support and logo manifest
- Admin tools for users, credits, bans, web/SMS access, panels, gift cards, broadcasts, and channel settings
- Single and bulk Firebase Realtime Database panel management, with serial panel names and shared auth-key support
- Premium emoji and small-caps user notifications for new numbers, bulk panel imports, gift cards, and credit updates
- Live SMS log forwarding to a Telegram group with wave-line format, premium emoji, small-caps text, and action buttons
- Parallel SMS log scanning across all configured Firebase panels, plus PostgreSQL dedupe/retry state to avoid repeat logs
- Health endpoint at `/api/healthz`
- Production build using esbuild

## Requirements

- Node.js 24.x
- pnpm 10.x
- PostgreSQL 14 or newer
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- One or more Firebase Realtime Database URLs and keys to add through the admin panel

The repository already includes the JavaScript dependency manifests and lockfile:

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `artifacts/api-server/package.json`
- `lib/db/package.json`

## Environment variables

Copy `.env.example` to `.env` for local development and set:

| Variable | Required | Description |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Yes | Private token created by BotFather |
| `ADMIN_PASSWORD` | Yes | Password for `/admin/login` |
| `DATABASE_URL` | Yes on Railway | PostgreSQL connection string |
| `NEON_DATABASE_URL` | Optional | Replit demo fallback for a Neon PostgreSQL connection |
| `BOT_USERNAME` | No | Bot username without `@`; defaults to `AnneBella_Sms_Panel_Bot` in code |
| `PUBLIC_APP_URL` | No | Public HTTPS URL used for Telegram web-panel links; Railway can use `RAILWAY_PUBLIC_DOMAIN` automatically |
| `OWNER_CHAT_ID` / `ADMIN_CHAT_ID` | Recommended | Owner/admin Telegram chat ID for payment approval notifications |
| `SMS_LOG_GROUP_ID` | No | Telegram group ID for live SMS logs; defaults to the configured AnneBella logs group |
| `SMS_LOG_GET_NUMBER_URL` | No | URL used by the SMS log `GET NUMBER` button; defaults to `https://t.me/Annebellasmsbot?start=promo` |
| `NODE_ENV` | No | Use `production` on hosted services |
| `LOG_LEVEL` | No | Pino log level; defaults to `info` |
| `PORT` | No | Supplied automatically by Heroku, Railway, and Replit |

Never commit `.env` files, bot tokens, database passwords, or admin passwords.

## Local setup

```bash
pnpm install
cp .env.example .env
# Edit .env with your own values
pnpm run db:push
pnpm run build
pnpm start
```

The API server listens on the port in `PORT`. Check that it is running with:

```bash
curl http://localhost:3000/api/healthz
```

Expected response:

```json
{"status":"ok"}
```

## Admin panel

Open `/admin/login` on the deployed service and sign in with `ADMIN_PASSWORD`. After signing in, configure Firebase panels and channels from the admin interface.

Use a strong, unique admin password. The default fallback in source code is intended only as a development safeguard and should never be relied on in production.

The admin panel can be installed from Chrome/Android as a PWA. Use it to add Firebase URLs, bulk-import many Firebase URLs with one auth key, monitor total/online/offline numbers, grant or deduct credits, unlock user access, generate gift cards, approve credit payments, and broadcast notifications to bot users.

If Chrome only creates a shortcut, redeploy the latest code and open `/admin` once after login. The app now serves `/admin.webmanifest`, `/admin-logo.svg`, and `/admin-sw.js`; all three must be reachable over HTTPS for install mode.

## Telegram Bot Flow

- New users receive 100 credits automatically.
- Getting a number costs 5 credits.
- Cancelling before any live SMS arrives refunds the 5 credits.
- If a live SMS arrives on the number, the purchase is considered used and no refund is issued.
- Referral rewards add 20 credits to the referrer.
- Web-panel access requires 1000 credits.
- Credit purchases show a UPI QR, then the user sends a screenshot for owner approval.

## Live SMS Logs

Set `SMS_LOG_GROUP_ID` to the Telegram group where live SMS logs should be forwarded. The watcher scans all Firebase panels in parallel every 15 seconds, reads online devices, and forwards genuinely new live SMS messages to the group.

Old SMS messages are seeded on startup so deploys do not spam historical logs. Sent SMS keys are stored in PostgreSQL, so the same SMS is not repeated after restart. If Telegram sending fails, the SMS stays pending and is retried on a later poll.

## Deploy to Heroku

1. Click the **Deploy to Heroku** button above.
2. Choose an app name and region.
3. Enter `TELEGRAM_BOT_TOKEN` and a strong `ADMIN_PASSWORD`.
4. Confirm the Heroku Postgres add-on.
5. Deploy the app.

The included `app.json` configures the Node buildpack, a Postgres add-on, and the required environment variables. After the first deploy, apply the database schema once:

```bash
heroku run pnpm run db:push -a your-app-name
```

If you deploy manually:

```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:essential-0 -a your-app-name
heroku config:set TELEGRAM_BOT_TOKEN="..." ADMIN_PASSWORD="..." BOT_USERNAME="TBH_VIP_BOT" NODE_ENV=production -a your-app-name
git push heroku main
```

## Deploy to Railway

1. Click the **Deploy on Railway** button above.
2. Add a PostgreSQL service to the Railway project.
3. Set these variables on the bot service:
   - `TELEGRAM_BOT_TOKEN`
   - `ADMIN_PASSWORD`
   - `BOT_USERNAME`
   - `NODE_ENV=production`
   - `DATABASE_URL` to the PostgreSQL service connection string. In Railway, use the PostgreSQL service variable reference, for example `${{Postgres.DATABASE_URL}}`.
4. Deploy and open the generated public domain. The admin panel is available at `/`, `/admin`, and `/admin/login`.
5. Railway runs the database schema push automatically before starting the service:

```bash
pnpm install
pnpm run db:push
```

Railway uses `railway.json` to run the build, push the schema before startup, start the API server, and check `/api/healthz`. Configure either `DATABASE_URL` or `NEON_DATABASE_URL` before publishing. The pre-deploy schema step runs before the web process starts; if Railway logs say `DATABASE_URL or NEON_DATABASE_URL is required`, the service will not open a web page or start the bot until the database variable is fixed.

If the log shows that message:

1. Add a PostgreSQL service to the same Railway project.
2. On the bot service, add `DATABASE_URL` as a Railway variable reference such as `${{Postgres.DATABASE_URL}}` (use your actual PostgreSQL service name).
3. Redeploy, then confirm `/api/healthz` returns `{"status":"ok"}`.

The HTTP server binds before Telegram polling starts, and Telegram polling errors are logged without taking down the admin panel. This makes a bad Telegram token or a temporary Telegram network failure visible without producing a misleading `Cannot GET /` page.

## API routes

The service is mounted under `/api`. Common endpoints include:

- `GET /api/healthz`
- `GET /api/dashboard`
- `GET /api/users`
- `GET /api/panels`
- `GET /api/channels`

The admin interface is served separately under `/admin/login`.

## Project layout

```text
artifacts/api-server/   Express API, Telegram bot, admin panel, and build
lib/db/                 PostgreSQL schema and Drizzle client
lib/api-zod/            Shared response schemas
lib/api-spec/           OpenAPI source and code generation
scripts/                Workspace utility scripts
attached_assets/        Imported project assets and configuration history
```

## Security notes

- Treat `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`, Firebase keys, and `ADMIN_PASSWORD` as secrets.
- Rotate any credential that has been exposed in a commit, screenshot, log, or chat.
- Restrict Firebase database rules and use least-privilege credentials.
- The admin panel is password protected, but it should still be deployed behind HTTPS.
- Review imported assets and configuration JSON before using them in production.

## License

No license has been declared yet. Add a `LICENSE` file before distributing this project publicly.
