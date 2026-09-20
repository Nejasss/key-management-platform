import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireUser, requireAdmin } from '@/lib/auth/session';
import { apiError, apiSuccess } from '@/lib/security/api-response';
import { updateLicenseSchema } from '@/lib/validation/schemas';
import { logActivity } from '@/lib/security/activity-log';
import { getClientIp } from '@/lib/rate-limit';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireUser();
  } catch {
    return apiError('You must be logged in', 'UNAUTHORIZED');
  }

  const [license] = await db.select().from(schema.licenses).where(eq(schema.licenses.id, params.id)).limit(1);
  if (!license) return apiError('License not found', 'NOT_FOUND');

  const devices = await db
    .select()
    .from(schema.licenseDevices)
    .where(eq(schema.licenseDevices.licenseId, params.id));

  return apiSuccess({ data: { ...license, devices } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

  const parsed = updateLicenseSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', 'INVALID_REQUEST');
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.expiresAt !== undefined) {
    updates.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  }
  if (parsed.data.maxDevices !== undefined) updates.maxDevices = parsed.data.maxDevices;
  if (parsed.data.note !== undefined) updates.note = parsed.data.note;

  const [updated] = await db
    .update(schema.licenses)
    .set(updates)
    .where(eq(schema.licenses.id, params.id))
    .returning();

  if (!updated) return apiError('License not found', 'NOT_FOUND');

  await logActivity({
    userId: user.id,
    action: 'update_key',
    licenseId: params.id,
    ip: getClientIp(req.headers),
    userAgent: req.headers.get('user-agent'),
    metadata: updates,
  });

  return apiSuccess({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireAdmin();
  } catch (err) {
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return apiError('Admin access required', 'FORBIDDEN');
    }
    return apiError('You must be logged in', 'UNAUTHORIZED');
  }

  const [deleted] = await db.delete(schema.licenses).where(eq(schema.licenses.id, params.id)).returning();
  if (!deleted) return apiError('License not found', 'NOT_FOUND');

  await logActivity({
    userId: user.id,
    action: 'delete_key',
    licenseId: params.id,
    ip: getClientIp(req.headers),
    userAgent: req.headers.get('user-agent'),
    metadata: { key: deleted.key },
  });

  return apiSuccess({ message: 'License deleted' });
}
