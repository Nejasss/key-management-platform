import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(255),
  remember: z.boolean().optional().default(false),
});

export const verifySchema = z.object({
  key: z.string().min(5).max(64),
  device_id: z.string().min(1).max(255),
});

export const generateKeySchema = z.object({
  prefix: z.string().min(1).max(32).default('LICENSE'),
  quantity: z.coerce.number().int().min(1).max(1000).default(1),
  segments: z.coerce.number().int().min(1).max(6).default(3),
  segmentLength: z.coerce.number().int().min(4).max(12).default(6),
  expiryDays: z.coerce.number().int().min(0).max(3650).nullable().optional(), // 0 or null = no expiry
  maxDevices: z.coerce.number().int().min(-1).max(1000).default(1), // -1 = unlimited
  note: z.string().max(500).optional(),
  autoActivate: z.boolean().default(true),
});

export const updateLicenseSchema = z.object({
  status: z.enum(['active', 'expired', 'revoked', 'unused']).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxDevices: z.coerce.number().int().min(-1).max(1000).optional(),
  note: z.string().max(500).optional(),
});

export const licenseListQuerySchema = z.object({
  search: z.string().max(255).optional(),
  status: z.enum(['active', 'expired', 'revoked', 'unused', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'expiresAt', 'key', 'status']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const settingsSchema = z.object({
  siteName: z.string().min(1).max(100),
  keyPrefix: z.string().min(1).max(32),
  defaultExpiryDays: z.coerce.number().int().min(0).max(3650),
  defaultDeviceLimit: z.coerce.number().int().min(-1).max(1000),
});
