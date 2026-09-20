import { NextRequest } from 'next/server';
import { getSessionUser, destroySession } from '@/lib/auth/session';
import { apiSuccess } from '@/lib/security/api-response';
import { logActivity } from '@/lib/security/activity-log';
import { getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  await destroySession();

  if (user) {
    await logActivity({
      userId: user.id,
      action: 'logout',
      ip: getClientIp(req.headers),
      userAgent: req.headers.get('user-agent'),
    });
  }

  return apiSuccess({ message: 'Logged out' });
}
