import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { apiError, apiSuccess } from '@/lib/security/api-response';
import { extendLicenseSchema } from '@/lib/validation/schemas';
import { logActivity } from '@/lib/security/activity-log';
import { getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/licenses/:id/extend
 * Extends a license's expiry by N days.
 *
 * - If the license still has time left, the days are added on top of the
 *   existing expiresAt (so "extend by 30 days" always means +30 days of
 *   runway, not +30 days from right now).
 * - If it has already expired (or `fromToday` is explicitly set), the
 *   new expiry is N days from now, and the status is revived to
 *   'active'.
 * - Revoked licenses cannot be extended — they must be explicitly
 *   reactivated (via PATCH status) first, since revocation is a
 *   deliberate security action and shouldn't be undone as a side
 *   effect of a date change.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const parsed = extendLicenseSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Invalid input', 'INVALID_REQUEST');
  }
  const { days, fromToday } = parsed.data;

  const [license] = await db.select().from(schema.licenses).where(eq(schema.licenses.id, params.id)).limit(1);
  if (!license) return apiError('License not found', 'NOT_FOUND');

  if (license.status === 'revoked') {
    return apiError('This license is revoked — reactivate it before extending', 'CONFLICT');
  }

  const now = new Date();
  const currentExpiry = license.expiresAt;
  const hasTimeLeft = currentExpiry !== null && currentExpiry.getTime() > now.getTime();

  const base = !fromToday && hasTimeLeft ? currentExpiry! : now;
  const newExpiresAt = new Date(base.getTime() + days * 86400000);

  const [updated] = await db
    .update(schema.licenses)
    .set({
      expiresAt: newExpiresAt,
      status: 'active',
      updatedAt: now,
    })
    .where(eq(schema.licenses.id, params.id))
    .returning();

  await logActivity({
    userId: user.id,
    action: 'update_key',
    licenseId: params.id,
    ip: getClientIp(req.headers),
    userAgent: req.headers.get('user-agent'),
    metadata: { key: license.key, action: 'extend', days, previousExpiry: currentExpiry, newExpiry: newExpiresAt },
  });

  return apiSuccess({ data: updated, message: `Extended by ${days} day${days === 1 ? '' : 's'}` });
}
