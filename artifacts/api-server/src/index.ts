import app from "./app";
import { initBot } from "./lib/bot";
import { logger } from "./lib/logger";
import { startSmsLogWatcher } from "./lib/smsLogWatcher";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const host = process.env["HOST"] ?? "0.0.0.0";

app.listen(port, host, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ host, port }, "Server listening");

  // Start polling only after HTTP is listening. A Telegram outage or invalid
  // token must not prevent Railway from reaching the admin panel/healthcheck.
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN is not set; Telegram polling is disabled");
    return;
  }

  try {
    initBot(false);
    startSmsLogWatcher();
    logger.info("Telegram bot initialized with polling");
  } catch (err) {
    logger.error({ err }, "Failed to initialize Telegram bot");
  }
});
