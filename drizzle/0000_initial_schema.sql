-- Migration: 0000_initial_schema
-- Generated to match db/schema.ts. If you modify schema.ts, prefer
-- running `npm run db:generate` to have drizzle-kit regenerate this
-- folder automatically instead of hand-editing.

CREATE TYPE "user_role" AS ENUM ('admin', 'user');
CREATE TYPE "license_status" AS ENUM ('active', 'expired', 'revoked', 'unused');

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(255) NOT NULL,
  "username" varchar(100) NOT NULL,
  "password_hash" text NOT NULL,
  "role" "user_role" NOT NULL DEFAULT 'user',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "last_login_at" timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");

CREATE TABLE IF NOT EXISTS "licenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" varchar(64) NOT NULL,
  "status" "license_status" NOT NULL DEFAULT 'unused',
  "prefix" varchar(32) NOT NULL,
  "max_devices" integer NOT NULL DEFAULT 1,
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "last_verified_at" timestamptz,
  "note" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "licenses_key_idx" ON "licenses" ("key");
CREATE INDEX IF NOT EXISTS "licenses_status_idx" ON "licenses" ("status");
CREATE INDEX IF NOT EXISTS "licenses_expires_idx" ON "licenses" ("expires_at");

CREATE TABLE IF NOT EXISTS "license_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "license_id" uuid NOT NULL REFERENCES "licenses"("id") ON DELETE CASCADE,
  "device_id" varchar(255) NOT NULL,
  "first_seen_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "ip" varchar(64),
  "user_agent" text
);
CREATE INDEX IF NOT EXISTS "license_devices_device_idx" ON "license_devices" ("device_id");
CREATE UNIQUE INDEX IF NOT EXISTS "license_devices_unique" ON "license_devices" ("license_id", "device_id");

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(128) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_hash_idx" ON "sessions" ("token_hash");

CREATE TABLE IF NOT EXISTS "activity_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" varchar(64) NOT NULL,
  "license_id" uuid REFERENCES "licenses"("id") ON DELETE SET NULL,
  "ip" varchar(64),
  "user_agent" text,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "activity_logs_created_at_idx" ON "activity_logs" ("created_at");

CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "site_name" varchar(100) NOT NULL DEFAULT 'Key Management Platform',
  "key_prefix" varchar(32) NOT NULL DEFAULT 'LICENSE',
  "default_expiry_days" integer NOT NULL DEFAULT 30,
  "default_device_limit" integer NOT NULL DEFAULT 1,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
