import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botUsersTable = pgTable("bot_users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: text("referred_by"),
  referralCount: integer("referral_count").notNull().default(0),
  smsCredits: integer("sms_credits").notNull().default(0),
  getNumberExpiresAt: timestamp("get_number_expires_at", { withTimezone: true }),
  sendSmsUnlocked: boolean("send_sms_unlocked").notNull().default(false),
  webPanelExpiresAt: timestamp("web_panel_expires_at", { withTimezone: true }),
  isBanned: boolean("is_banned").notNull().default(false),
  state: text("state").notNull().default("main_menu"),
  stateData: text("state_data"),
  assignedDeviceId: text("assigned_device_id"),
  assignedPanelId: integer("assigned_panel_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBotUserSchema = createInsertSchema(botUsersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBotUser = z.infer<typeof insertBotUserSchema>;
export type BotUser = typeof botUsersTable.$inferSelect;
