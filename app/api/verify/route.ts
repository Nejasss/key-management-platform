import { NextRequest, NextResponse } from 'next/server';
import { verifySchema } from '@/lib/validation/schemas';
import { verifyLicenseKey } from '@/lib/license/verify';
import { logActivity } from '@/lib/security/activity-log';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import {
  isEncryptionConfigured,
  encryptPayload,
  decryptPayload,
  signPayload,
  verifySignature,
  isTimestampFresh,
  checkAndRecordReplay,
  type EncryptedEnvelope,
} from '@/lib/security/crypto';

/**
 * POST /api/verify
 * Public endpoint (rate limited). External client apps call this to
 * verify a license key + device_id pair.
 *
 * Never returns: password, password hash, database credentials,
 * session tokens, or any environment variables.
 *
 * ---------- Transport security ----------
 * HTTPS covers the wire, but a proxy tool running on the client's own
 * device (Fiddler/Charles/Frida with a self-trusted cert) can still read
 * or rewrite the plain response. When API_ENCRYPTION_KEY and
 * API_HMAC_SECRET are both set, this endpoint requires every request and
 * response to be wrapped in an encrypted, signed envelope — see
 * examples/verify-client/ for matching client implementations and
 * README.md section 10 for the full protocol.
 *
 * When those env vars are NOT set, the endpoint falls back to plain JSON
 * (useful for local development) and logs a one-time warning.
 */

let warnedPlaintext = false;

function respondPlain(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status });
}

function respondSecure(payload: Record<string, unknown>, status = 200) {
  if (!isEncryptionConfigured()) return respondPlain(payload, status);

  const timestamp = Date.now().toString();
  const envelope = encryptPayload(JSON.stringify(payload));
  const bodyString = JSON.stringify(envelope);
  const signature = signPayload(timestamp, bodyString);

  return new NextResponse(bodyString, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    },
  });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const userAgent = req.headers.get('user-agent');

  const encryptionOn = isEncryptionConfigured();
  if (!encryptionOn && !warnedPlaintext) {
    warnedPlaintext = true;
    console.warn(
      '[verify] API_ENCRYPTION_KEY / API_HMAC_SECRET not set — /api/verify is running in ' +
        'plaintext mode. Set both env vars to require encrypted+signed requests. See README.md §10.'
    );
  }

  const limited = rateLimit(`verify:${ip}`, 30, 60 * 1000);
  if (!limited.success) {
    const respond = encryptionOn ? respondSecure : respondPlain;
    return respond({ valid: false, message: 'Too many verification requests. Please slow down.' }, 429);
  }

  const rawBody = await req.text();
  let key: string;
  let device_id: string;

  if (encryptionOn) {
    const timestamp = req.headers.get('x-timestamp');
    const signature = req.headers.get('x-signature');

    if (!timestamp || !signature) {
      return respondSecure({ valid: false, message: 'Missing signature headers' }, 400);
    }
    if (!isTimestampFresh(timestamp)) {
      return respondSecure({ valid: false, message: 'Request expired or clock skew too large' }, 401);
    }
    if (!verifySignature(timestamp, rawBody, signature)) {
      return respondSecure({ valid: false, message: 'Invalid signature' }, 401);
    }
    if (!checkAndRecordReplay(signature)) {
      return respondSecure({ valid: false, message: 'Replay detected' }, 409);
    }

    let envelope: EncryptedEnvelope;
    try {
      envelope = JSON.parse(rawBody);
    } catch {
      return respondSecure({ valid: false, message: 'Invalid envelope JSON' }, 400);
    }

    let plaintext: string;
    try {
      plaintext = decryptPayload(envelope);
    } catch {
      return respondSecure({ valid: false, message: 'Decryption failed' }, 400);
    }

    let decryptedBody: unknown;
    try {
      decryptedBody = JSON.parse(plaintext);
    } catch {
      return respondSecure({ valid: false, message: 'Invalid decrypted payload' }, 400);
    }

    const parsed = verifySchema.safeParse(decryptedBody);
    if (!parsed.success) {
      return respondSecure({ valid: false, message: 'Invalid request: key and device_id are required' }, 400);
    }
    ({ key, device_id } = parsed.data);
  } else {
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return respondPlain({ valid: false, message: 'Invalid JSON body' }, 400);
    }
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return respondPlain({ valid: false, message: 'Invalid request: key and device_id are required' }, 400);
    }
    ({ key, device_id } = parsed.data);
  }

  const result = await verifyLicenseKey(key, device_id, { ip, userAgent });

  await logActivity({
    action: result.valid ? 'verification_request' : 'verification_failed',
    licenseId: result.license?.id ?? null,
    ip,
    userAgent,
    metadata: { key, device_id, result: result.code, encrypted: encryptionOn },
  });

  const respond = encryptionOn ? respondSecure : respondPlain;

  if (!result.valid) {
    const messages: Record<string, string> = {
      not_found: 'License invalid',
      revoked: 'License has been revoked',
      expired: 'License has expired',
      device_limit_reached: 'Maximum number of devices reached for this license',
    };
    return respond({ valid: false, message: messages[result.code] ?? 'License invalid' }, 200);
  }

  return respond({
    valid: true,
    message: 'License valid',
    key: result.license!.key,
    status: result.license!.status,
    expires_at: result.license!.expiresAt,
    device_bound: result.deviceBound,
  });
}
