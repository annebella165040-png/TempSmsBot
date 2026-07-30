import { Router, type IRouter } from "express";
import { processUpdate } from "../lib/bot";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/bot/webhook", async (req, res): Promise<void> => {
  try {
    processUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    logger.error({ err }, "Webhook processing error");
    res.sendStatus(200); // Always return 200 to Telegram
  }
});

export default router;
