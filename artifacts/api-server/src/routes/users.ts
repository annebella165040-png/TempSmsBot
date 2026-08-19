import { Router, type IRouter } from "express";
import { db, botUsersTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { GetUserParams, UpdateUserParams, UpdateUserBody } from "@workspace/api-zod";
import { notifyCreditsUpdated } from "../lib/notifications";

const router: IRouter = Router();

function serializeUser(u: typeof botUsersTable.$inferSelect) {
  return {
    id: u.id,
    telegramId: u.telegramId,
    username: u.username,
    firstName: u.firstName,
    referralCode: u.referralCode,
    referredBy: u.referredBy,
    referralCount: u.referralCount,
    smsCredits: u.smsCredits,
    getNumberExpiresAt: u.getNumberExpiresAt?.toISOString() ?? null,
    sendSmsUnlocked: u.sendSmsUnlocked,
    webPanelExpiresAt: u.webPanelExpiresAt?.toISOString() ?? null,
    isBanned: u.isBanned,
    state: u.state,
    assignedDeviceId: u.assignedDeviceId,
    assignedPanelId: u.assignedPanelId,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

router.get("/users", async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  let users;
  if (search) {
    users = await db
      .select()
      .from(botUsersTable)
      .where(
        or(
          ilike(botUsersTable.firstName, `%${search}%`),
          ilike(botUsersTable.username ?? botUsersTable.firstName, `%${search}%`),
          ilike(botUsersTable.telegramId, `%${search}%`)
        )
      )
      .orderBy(botUsersTable.createdAt);
  } else {
    users = await db.select().from(botUsersTable).orderBy(botUsersTable.createdAt);
  }
  res.json(users.map(serializeUser));
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetUserParams.safeParse({ id: parseFloat(raw) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [user] = await db.select().from(botUsersTable).where(eq(botUsersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(serializeUser(user));
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateUserParams.safeParse({ id: parseFloat(rawId) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.smsCredits !== undefined) updateData.smsCredits = parsed.data.smsCredits;
  if (parsed.data.sendSmsUnlocked !== undefined) updateData.sendSmsUnlocked = parsed.data.sendSmsUnlocked;
  if (parsed.data.getNumberExpiresAt !== undefined) {
    updateData.getNumberExpiresAt = parsed.data.getNumberExpiresAt ? new Date(parsed.data.getNumberExpiresAt) : null;
  }
  if (parsed.data.webPanelExpiresAt !== undefined) {
    updateData.webPanelExpiresAt = parsed.data.webPanelExpiresAt ? new Date(parsed.data.webPanelExpiresAt) : null;
  }
  // isBanned — handled outside zod schema
  if (typeof (req.body as any).isBanned === "boolean") updateData.isBanned = (req.body as any).isBanned;

  const [before] = await db.select().from(botUsersTable).where(eq(botUsersTable.id, params.data.id));
  if (!before) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [updated] = await db
    .update(botUsersTable)
    .set(updateData)
    .where(eq(botUsersTable.id, params.data.id))
    .returning();

  if (parsed.data.smsCredits !== undefined && updated.smsCredits !== before.smsCredits) {
    void notifyCreditsUpdated(updated.telegramId, before.smsCredits, updated.smsCredits);
  }
  res.json(serializeUser(updated));
});

export default router;
