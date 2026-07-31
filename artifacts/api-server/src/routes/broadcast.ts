import { Router, type IRouter } from "express";
import { db, botUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getBot } from "../lib/bot";

const router: IRouter = Router();

router.post("/broadcast", async (req, res): Promise<void> => {
  const { message } = req.body;
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  const bot = getBot();
  if (!bot) {
    res.status(503).json({ error: "Bot not initialised" });
    return;
  }

  const users = await db
    .select({ telegramId: botUsersTable.telegramId })
    .from(botUsersTable)
    .where(eq(botUsersTable.isBanned, false));

  let sent = 0, failed = 0;
  for (const u of users) {
    try {
      await bot.sendMessage(Number(u.telegramId), message, { parse_mode: "HTML" });
      sent++;
    } catch {
      failed++;
    }
    // small delay to avoid flood
    await new Promise(r => setTimeout(r, 50));
  }

  res.json({ sent, failed, total: users.length });
});

export default router;
