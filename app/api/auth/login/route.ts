import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { loginSchema } from '@/lib/validation/schemas';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { apiError, apiSuccess, stripSensitive } from '@/lib/security/api-response';
import { logActivity } from '@/lib/security/activity-log';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const userAgent = req.headers.get('user-agent');

  const limited = rateLimit(`login:${ip}`, 10, 5 * 60 * 1000);
  if (!limited.success) {
    return apiError('Too many login attempts. Please try again later.', 'RATE_LIMITED');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 'INVALID_REQUEST');
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid email or password format', 'INVALID_REQUEST');
  }

  const { email, password, remember } = parsed.data;

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase()))
    .limit(1);

  // Constant-shape response whether user exists or not, to avoid
  // user-enumeration via timing/response differences.
  const genericFail = async () => {
    await logActivity({ action: 'login_failed', ip, userAgent, metadata: { email } });
    return apiError('Invalid email or password', 'UNAUTHORIZED');
  };

  if (!user || !user.isActive) {
    return genericFail();
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return genericFail();
  }

  await createSession(user.id, remember);

  await db
    .update(schema.users)
    .set({ lastLoginAt: new Date() })
    .where(eq(schema.users.id, user.id));

  await logActivity({ userId: user.id, action: 'login', ip, userAgent });

  return apiSuccess({
    message: 'Login successful',
    user: stripSensitive({ id: user.id, email: user.email, username: user.username, role: user.role }),
  });
}
