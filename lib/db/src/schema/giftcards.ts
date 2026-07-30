import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const giftCardsTable = pgTable("gift_cards", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // 'hours' | 'credits'
  value: text("value").notNull(), // stored as string, parsed as number
  usedBy: text("used_by"),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGiftCardSchema = createInsertSchema(giftCardsTable).omit({ id: true, createdAt: true, usedBy: true, usedAt: true });
export type InsertGiftCard = z.infer<typeof insertGiftCardSchema>;
export type GiftCard = typeof giftCardsTable.$inferSelect;
