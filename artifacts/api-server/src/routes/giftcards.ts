import { Router, type IRouter } from "express";
import { db, giftCardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateGiftCardBody, DeleteGiftCardParams } from "@workspace/api-zod";
import { notifyGiftCardCreated } from "../lib/notifications";

const router: IRouter = Router();

function serializeCard(c: typeof giftCardsTable.$inferSelect) {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: parseInt(c.value, 10),
    usedBy: c.usedBy,
    usedAt: c.usedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/gift-cards", async (_req, res): Promise<void> => {
  const cards = await db.select().from(giftCardsTable).orderBy(giftCardsTable.createdAt);
  res.json(cards.map(serializeCard));
});

router.post("/gift-cards", async (req, res): Promise<void> => {
  const parsed = CreateGiftCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [card] = await db
    .insert(giftCardsTable)
    .values({
      code: parsed.data.code.toUpperCase().trim(),
      type: parsed.data.type,
      value: String(parsed.data.value),
    })
    .returning();
  void notifyGiftCardCreated(card.code, card.type, parseInt(card.value, 10));
  res.status(201).json(serializeCard(card));
});

router.delete("/gift-cards/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteGiftCardParams.safeParse({ id: parseFloat(raw) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [deleted] = await db
    .delete(giftCardsTable)
    .where(eq(giftCardsTable.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Gift card not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
