import { Router, type IRouter } from "express";
import { db, panelsTable, botUsersTable, giftCardsTable } from "@workspace/db";
import { isNotNull, gt, count } from "drizzle-orm";
import { fetchPanelDevices } from "../lib/firebase";

const router: IRouter = Router();

router.get("/dashboard", async (_req, res): Promise<void> => {
  // Fetch all panels + live device counts
  const panels = await db.select().from(panelsTable);

  const panelBreakdown = [];
  let totalOnline = 0;
  let totalOffline = 0;

  for (const panel of panels) {
    const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
    const online = devices.filter((d) => d.status).length;
    const offline = devices.length - online;
    totalOnline += online;
    totalOffline += offline;
    panelBreakdown.push({
      panelId: panel.id,
      panelName: panel.name,
      online,
      offline,
      total: devices.length,
    });
  }

  const [usersResult] = await db.select({ count: count() }).from(botUsersTable);
  const now = new Date();
  const [activeResult] = await db
    .select({ count: count() })
    .from(botUsersTable)
    .where(gt(botUsersTable.getNumberExpiresAt, now));

  const [totalGiftResult] = await db.select({ count: count() }).from(giftCardsTable);
  const [usedGiftResult] = await db
    .select({ count: count() })
    .from(giftCardsTable)
    .where(isNotNull(giftCardsTable.usedBy));

  res.json({
    totalPanels: panels.length,
    totalDevices: totalOnline + totalOffline,
    onlineDevices: totalOnline,
    offlineDevices: totalOffline,
    totalUsers: usersResult.count,
    activeUsers: activeResult.count,
    totalGiftCards: totalGiftResult.count,
    usedGiftCards: usedGiftResult.count,
    panelBreakdown,
  });
});

export default router;
