import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const waitlist = sqliteTable('waitlist', {
  email: text('email').primaryKey(),
  plan: text('plan').notNull(),
  useCase: text('use_case').notNull().default(''),
  source: text('source').notNull().default('direct'),
  consentVersion: text('consent_version').notNull(),
  consentAt: text('consent_at').notNull(),
  createdAt: text('created_at').notNull(),
  removalHash: text('removal_hash').notNull().unique(),
});
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(1),
  expiresAt: integer('expires_at').notNull(),
});
