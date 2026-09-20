import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { and, desc, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { apiError, apiSuccess } from '@/lib/security/api-response';
import { licenseListQuerySchema, generateKeySchema } from '@/lib/validation/schemas';
import { generateBulkKeys } from '@/lib/license/generator';
import { logActivity } from '@/lib/security/activity-log';
import { getClientIp } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return apiError('You must be logged in', 'UNAUTHORIZED');
  }

  const { searchParams } = new URL(req.url);
  const parsed = licenseListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return apiError('Invalid query parameters', 'INVALID_REQUEST');
  }
  const { search, status, page, pageSize, sortBy, sortDir } = parsed.data;

  const conditions = [];
  if (search) {
    conditions.push(or(ilike(schema.licenses.key, `%${search}%`), ilike(schema.licenses.note, `%${search}%`)));
  }
  if (status !== 'all') {
    conditions.push(eq(schema.licenses.status, status));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const sortColumn = schema.licenses[sortBy];
  const orderFn = sortDir === 'asc' ? asc : desc;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(schema.licenses)
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.licenses).where(where),
  ]);

  return apiSuccess({
    data: rows,
    pagination: {
      page,
      pageSize,
      total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / pageSize),
    },
  });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return apiError('You must be logged in', 'UNAUTHORIZED');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 'INVALID_REQUEST');
  }

  const parsed = generateKeySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Invalid input', 'INVALID_REQUEST');
  }

  const { prefix, quantity, segments, segmentLength, expiryDays, maxDevices, note, autoActivate } =
    parsed.data;

  const existing = await db.select({ key: schema.licenses.key }).from(schema.licenses);
  const existingKeys = new Set(existing.map((r) => r.key));

  let keys: string[];
  try {
    keys = generateBulkKeys(quantity, { prefix, segments, segmentLength }, existingKeys);
  } catch (err) {
    return apiError('Failed to generate unique keys, please try again', 'CONFLICT');
  }

  const expiresAt = expiryDays && expiryDays > 0 ? new Date(Date.now() + expiryDays * 86400000) : null;

  const values = keys.map((key) => ({
    key,
    prefix,
    status: (autoActivate ? 'active' : 'unused') as 'active' | 'unused',
    maxDevices,
    expiresAt,
    note: note || null,
    createdBy: user.id,
  }));

  const inserted = await db.insert(schema.licenses).values(values).returning();

  await logActivity({
    userId: user.id,
    action: 'generate_key',
    ip: getClientIp(req.headers),
    userAgent: req.headers.get('user-agent'),
    metadata: { quantity, prefix, maxDevices, expiryDays },
  });

  return apiSuccess({ data: inserted }, 201);
}
