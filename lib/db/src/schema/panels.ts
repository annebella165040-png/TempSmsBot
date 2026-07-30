import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const panelsTable = pgTable("firebase_panels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  firebaseUrl: text("firebase_url").notNull(),
  secretKey: text("secret_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPanelSchema = createInsertSchema(panelsTable).omit({ id: true, createdAt: true });
export type InsertPanel = z.infer<typeof insertPanelSchema>;
export type Panel = typeof panelsTable.$inferSelect;
