import { Router, type IRouter } from "express";
import { db, panelsTable, botUsersTable, giftCardsTable } from "@workspace/db";
import { isNotNull, gt, count } from "drizzle-orm";
import { fetchPanelDevices } from "../lib/firebase";

const router: IRouter = Router();
const DASHBOARD_PANEL_TIMEOUT_MS = 5000;

async function fetchPanelDevicesForDashboard(
  firebaseUrl: string,
  secretKey: string,
  panelId: number,
  panelName: string,
) {
  return Promise.race([
    fetchPanelDevices(firebaseUrl, secretKey, panelId, panelName),
    new Promise<[]>(resolve => setTimeout(() => resolve([]), DASHBOARD_PANEL_TIMEOUT_MS)),
  ]);
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  // Fetch every Firebase panel in parallel so one slow panel does not hold up
  // the whole dashboard for users with many Firebase URLs configured.
  const panels = await db.select().from(panelsTable);
  const now = new Date();

  const [panelResults, [usersResult], [activeResult], [totalGiftResult], [usedGiftResult]] =
    await Promise.all([
      Promise.allSettled(
        panels.map(async (panel) => {
          const devices = await fetchPanelDevicesForDashboard(
            panel.firebaseUrl,
            panel.secretKey,
            panel.id,
            panel.name,
          );
          const online = devices.filter((d) => d.status).length;
          const offline = devices.length - online;
          return {
            panelId: panel.id,
            panelName: panel.name,
            online,
            offline,
            total: devices.length,
          };
        }),
      ),
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

  const panelBreakdown = panelResults.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const panel = panels[index];
    return {
      panelId: panel.id,
      panelName: panel.name,
      online: 0,
      offline: 0,
      total: 0,
    };
  });
  const totalOnline = panelBreakdown.reduce((sum, panel) => sum + panel.online, 0);
  const totalOffline = panelBreakdown.reduce((sum, panel) => sum + panel.offline, 0);

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
