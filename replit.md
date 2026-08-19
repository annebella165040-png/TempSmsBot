# Temp OTP Telegram Bot

Telegram bot and admin panel for managing Firebase-backed SMS panels, with PostgreSQL persistence.

## Run & Operate

- `pnpm install` — install workspace dependencies
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — typecheck libraries and workspace packages
- `pnpm run build` — build the production API bundle
- `pnpm run db:push` — apply the Drizzle schema to the configured database
- Required env: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, and `ADMIN_PASSWORD`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Telegram polling bot
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/lib/bot.ts` — Telegram bot behavior
- `artifacts/api-server/src/routes/` — API and admin routes
- `lib/db/src/schema/` — PostgreSQL schema
- `README.md` — setup, environment variables, and deployment instructions

## Architecture decisions

- Telegram uses polling so the bot can run on Heroku, Railway, or Replit without a webhook endpoint.
- Firebase panel credentials are stored in PostgreSQL and entered through the authenticated admin panel.
- The production build targets the API server only; the mockup sandbox remains a development/design artifact.

## Product

- Telegram number and SMS workflows backed by configured Firebase panels
- Password-protected admin panel for users, panels, channels, gift cards, broadcasts, and dashboard data

## User preferences

- Keep deployment instructions and environment requirements in `README.md`.

## Gotchas

- Never commit `.env`, Telegram tokens, Firebase keys, database URLs, or admin passwords.
- Heroku runs the database schema push from `Procfile`; Railway requires the one-time `pnpm run db:push` step described in `README.md`.

## Pointers

- See `README.md` for the complete user-facing project documentation.
