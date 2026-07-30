import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { initBot } from "./lib/bot";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Initialize Telegram bot with polling (no webhook needed in dev)
if (process.env.TELEGRAM_BOT_TOKEN) {
  try {
    initBot(false);
    logger.info("Telegram bot initialized with polling");
  } catch (err) {
    logger.error({ err }, "Failed to initialize Telegram bot");
  }
}

export default app;
