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

  const [updated] = await db
    .update(schema.licenses)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(schema.licenses.id, params.id))
    .returning();

  if (!updated) return apiError('License not found', 'NOT_FOUND');

  await logActivity({
    userId: user.id,
    action: 'revoke_key',
    licenseId: params.id,
    ip: getClientIp(req.headers),
    userAgent: req.headers.get('user-agent'),
    metadata: { key: updated.key },
  });

  return apiSuccess({ data: updated, message: 'License revoked' });
}
