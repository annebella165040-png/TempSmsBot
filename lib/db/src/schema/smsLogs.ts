import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const smsLogEntriesTable = pgTable("sms_log_entries", {
  id: serial("id").primaryKey(),
  smsKey: text("sms_key").notNull().unique(),
  panelId: integer("panel_id").notNull(),
  deviceId: text("device_id").notNull(),
  sender: text("sender"),
  messageText: text("message_text").notNull(),
  messageTime: text("message_time"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SmsLogEntry = typeof smsLogEntriesTable.$inferSelect;
