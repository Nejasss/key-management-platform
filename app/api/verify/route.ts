import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifySchema } from '@/lib/validation/schemas';
import { verifyLicenseKey } from '@/lib/license/verify';
import { logActivity } from '@/lib/security/activity-log';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/verify
 * Public endpoint (rate limited). External client apps call this to
 * verify a license key + device_id pair.
 *
 * Never returns: password, password hash, database credentials,
 * session tokens, or any environment variables.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const userAgent = req.headers.get('user-agent');

  const limited = rateLimit(`verify:${ip}`, 30, 60 * 1000);
  if (!limited.success) {
    return NextResponse.json(
      { valid: false, message: 'Too many verification requests. Please slow down.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { valid: false, message: 'Invalid request: key and device_id are required' },
      { status: 400 }
    );
  }

  const { key, device_id } = parsed.data;

  const result = await verifyLicenseKey(key, device_id, { ip, userAgent });

  await logActivity({
    action: result.valid ? 'verification_request' : 'verification_failed',
    licenseId: result.license?.id ?? null,
    ip,
    userAgent,
    metadata: { key, device_id, result: result.code },
  });

  if (!result.valid) {
    const messages: Record<string, string> = {
      not_found: 'License invalid',
      revoked: 'License has been revoked',
      expired: 'License has expired',
      device_limit_reached: 'Maximum number of devices reached for this license',
    };
    return NextResponse.json(
      { valid: false, message: messages[result.code] ?? 'License invalid' },
      { status: 200 }
    );
  }

  return NextResponse.json({
    valid: true,
    message: 'License valid',
    key: result.license!.key,
    status: result.license!.status,
    expires_at: result.license!.expiresAt,
    device_bound: result.deviceBound,
  });
}
