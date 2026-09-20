import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { apiError, apiSuccess } from '@/lib/security/api-response';
import { logActivity } from '@/lib/security/activity-log';
import { getClientIp } from '@/lib/rate-limit';

/**
 * DELETE /api/licenses/:id/devices/:deviceId
 * Unbinds a single device from a license, freeing up its device slot,
 * without touching any other devices bound to the same license (unlike
 * /reset-device, which clears all of them at once).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; deviceId: string } }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return apiError('You must be logged in', 'UNAUTHORIZED');
  }

  const [license] = await db
    .select()
    .from(schema.licenses)
    .where(eq(schema.licenses.id, params.id))
    .limit(1);

  if (!license) return apiError('License not found', 'NOT_FOUND');

  const decodedDeviceId = decodeURIComponent(params.deviceId);

  const [deleted] = await db
    .delete(schema.licenseDevices)
    .where(
      and(
        eq(schema.licenseDevices.licenseId, params.id),
        eq(schema.licenseDevices.deviceId, decodedDeviceId)
      )
    )
    .returning();

  if (!deleted) return apiError('Device binding not found', 'NOT_FOUND');

  await logActivity({
    userId: user.id,
    action: 'reset_device',
    licenseId: params.id,
    ip: getClientIp(req.headers),
    userAgent: req.headers.get('user-agent'),
    metadata: { key: license.key, deviceId: decodedDeviceId, scope: 'single' },
  });

  return apiSuccess({ message: 'Device unbound' });
}
