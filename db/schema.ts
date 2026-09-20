import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------- Enums ----------
export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);
export const licenseStatusEnum = pgEnum('license_status', [
  'active',
  'expired',
  'revoked',
  'unused',
]);

// ---------- Users ----------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  username: varchar('username', { length: 100 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
}));

// ---------- Licenses ----------
export const licenses = pgTable('licenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 64 }).notNull(),
  status: licenseStatusEnum('status').notNull().default('unused'),
  prefix: varchar('prefix', { length: 32 }).notNull(),
  maxDevices: integer('max_devices').notNull().default(1), // -1 = unlimited
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  note: text('note'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  keyIdx: uniqueIndex('licenses_key_idx').on(table.key),
  statusIdx: index('licenses_status_idx').on(table.status),
  expiresIdx: index('licenses_expires_idx').on(table.expiresAt),
}));

// ---------- License Devices ----------
export const licenseDevices = pgTable('license_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  licenseId: uuid('license_id')
    .notNull()
    .references(() => licenses.id, { onDelete: 'cascade' }),
  deviceId: varchar('device_id', { length: 255 }).notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  ip: varchar('ip', { length: 64 }),
  userAgent: text('user_agent'),
}, (table) => ({
  deviceIdx: index('license_devices_device_idx').on(table.deviceId),
  licenseDeviceUnique: uniqueIndex('license_devices_unique').on(table.licenseId, table.deviceId),
}));

// ---------- Sessions ----------
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 128 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenHashIdx: uniqueIndex('sessions_token_hash_idx').on(table.tokenHash),
}));

// ---------- Activity Logs ----------
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 64 }).notNull(),
  licenseId: uuid('license_id').references(() => licenses.id, { onDelete: 'set null' }),
  ip: varchar('ip', { length: 64 }),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  createdAtIdx: index('activity_logs_created_at_idx').on(table.createdAt),
}));

// ---------- Relations ----------
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  licenses: many(licenses),
  activityLogs: many(activityLogs),
}));

export const licensesRelations = relations(licenses, ({ many, one }) => ({
  devices: many(licenseDevices),
  createdByUser: one(users, {
    fields: [licenses.createdBy],
    references: [users.id],
  }),
}));

export const licenseDevicesRelations = relations(licenseDevices, ({ one }) => ({
  license: one(licenses, {
    fields: [licenseDevices.licenseId],
    references: [licenses.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
  license: one(licenses, {
    fields: [activityLogs.licenseId],
    references: [licenses.id],
  }),
}));

// ---------- App Settings (singleton row) ----------
export const appSettings = pgTable('app_settings', {
  id: integer('id').primaryKey().default(1),
  siteName: varchar('site_name', { length: 100 }).notNull().default('Key Management Platform'),
  keyPrefix: varchar('key_prefix', { length: 32 }).notNull().default('LICENSE'),
  defaultExpiryDays: integer('default_expiry_days').notNull().default(30),
  defaultDeviceLimit: integer('default_device_limit').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AppSettings = typeof appSettings.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type License = typeof licenses.$inferSelect;
export type NewLicense = typeof licenses.$inferInsert;
export type LicenseDevice = typeof licenseDevices.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
