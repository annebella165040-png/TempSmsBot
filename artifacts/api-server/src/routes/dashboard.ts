import { Router, type IRouter } from "express";
import { db, panelsTable, botUsersTable, giftCardsTable } from "@workspace/db";
import { isNotNull, gt, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard", async (_req, res): Promise<void> => {
  // Keep the dashboard instant. Live Firebase scans can become slow when many
  // panel URLs are configured, so this overview only uses local database data.
  const now = new Date();

  const [panels, [usersResult], [activeResult], [totalGiftResult], [usedGiftResult]] =
    await Promise.all([
      db.select().from(panelsTable).orderBy(panelsTable.createdAt),
      db.select({ count: count() }).from(botUsersTable),
      db
        .select({ count: count() })
        .from(botUsersTable)
        .where(gt(botUsersTable.getNumberExpiresAt, now)),
      db.select({ count: count() }).from(giftCardsTable),
      db
        .select({ count: count() })
        .from(giftCardsTable)
        .where(isNotNull(giftCardsTable.usedBy)),
    ]);

  const panelBreakdown = panels.map((panel) => ({
    panelId: panel.id,
    panelName: panel.name,
    online: 0,
    offline: 0,
    total: 0,
  }));

  res.json({
    totalPanels: panels.length,
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    totalUsers: usersResult.count,
    activeUsers: activeResult.count,
    totalGiftCards: totalGiftResult.count,
    usedGiftCards: usedGiftResult.count,
    panelBreakdown,
  });
});

export default router;
