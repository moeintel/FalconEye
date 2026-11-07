import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const interestTable = pgTable("falcon_interest", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  channel: text("channel").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull().defaultNow(),
});

export const visitsTable = pgTable("falcon_visits", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
});
