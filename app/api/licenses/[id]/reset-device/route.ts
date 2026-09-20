import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { apiError, apiSuccess } from '@/lib/security/api-response';
import { logActivity } from '@/lib/security/activity-log';
import { getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return apiError('You must be logged in', 'UNAUTHORIZED');
  }

  const [license] = await db.select().from(schema.licenses).where(eq(schema.licenses.id, params.id)).limit(1);
  if (!license) return apiError('License not found', 'NOT_FOUND');

  await db.delete(schema.licenseDevices).where(eq(schema.licenseDevices.licenseId, params.id));

  await logActivity({
    userId: user.id,
    action: 'reset_device',
    licenseId: params.id,
    ip: getClientIp(req.headers),
    userAgent: req.headers.get('user-agent'),
    metadata: { key: license.key },
  });

  return apiSuccess({ message: 'Device binding reset' });
}
