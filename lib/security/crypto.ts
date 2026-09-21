import { randomBytes, createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from 'crypto';

/**
 * Application-layer crypto for /api/verify.
 *
 * HTTPS already encrypts traffic in transit — but for a license/anti-piracy
 * endpoint, the more realistic threat is someone running a proxy tool
 * (Fiddler, Charles, Frida, mitmproxy with a self-installed trusted cert)
 * directly on the *client's own device*, where TLS termination happens
 * before the app ever sees the response. That lets them read the plain
 * JSON and, worse, rewrite `valid: false` into `valid: true` in transit.
 *
 * This module adds a second layer on top of HTTPS:
 *  - AES-256-GCM: encrypts the request/response body, so a proxy sees only
 *    ciphertext, not the license key, device_id, or verdict.
 *  - HMAC-SHA256 + timestamp: signs the envelope so tampering (or replaying
 *    an old captured request/response) is detectable — GCM's auth tag
 *    already protects the ciphertext itself, but the HMAC covers the
 *    timestamp/signature handshake and lets a client reject a forged
 *    request fast, without attempting a decrypt first.
 *
 * Both layers use *separate* secrets (API_ENCRYPTION_KEY, API_HMAC_SECRET)
 * so that compromising one doesn't compromise the other.
 */

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended IV size for GCM
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // also doubles as the timestamp tolerance

export interface EncryptedEnvelope {
  iv: string; // base64
  tag: string; // base64
  data: string; // base64 ciphertext
}

export function isEncryptionConfigured(): boolean {
  return Boolean(process.env.API_ENCRYPTION_KEY && process.env.API_HMAC_SECRET);
}

function getEncryptionKey(): Buffer {
  const b64 = process.env.API_ENCRYPTION_KEY;
  if (!b64) throw new Error('API_ENCRYPTION_KEY is not set');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) {
    throw new Error('API_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256). Generate one with: openssl rand -base64 32');
  }
  return key;
}

function getHmacSecret(): string {
  const secret = process.env.API_HMAC_SECRET;
  if (!secret) throw new Error('API_HMAC_SECRET is not set');
  return secret;
}

/** Encrypts a UTF-8 string, returning a base64 envelope. */
export function encryptPayload(plaintext: string): EncryptedEnvelope {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

/**
 * Decrypts an envelope back to the original UTF-8 string. Throws if the
 * auth tag doesn't match — i.e. the ciphertext was corrupted or tampered
 * with — which is GCM's built-in integrity check on top of confidentiality.
 */
export function decryptPayload(envelope: EncryptedEnvelope): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const data = Buffer.from(envelope.data, 'base64');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

/** HMAC-SHA256 over `${timestamp}.${body}`, hex-encoded. */
export function signPayload(timestamp: string, body: string): string {
  return createHmac('sha256', getHmacSecret()).update(`${timestamp}.${body}`).digest('hex');
}

/** Constant-time signature comparison — never use `===` on secrets/signatures. */
export function verifySignature(timestamp: string, body: string, signature: string): boolean {
  try {
    const expected = Buffer.from(signPayload(timestamp, body), 'hex');
    const actual = Buffer.from(signature, 'hex');
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** A request timestamp must be within this many ms of "now" (clock skew tolerance + replay window). */
export function isTimestampFresh(timestamp: string): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() - ts) <= REPLAY_WINDOW_MS;
}

// ---------- Replay protection ----------
// In-memory, best-effort per serverless instance — same caveat as
// lib/rate-limit: for strict cross-instance replay protection, back
// this with Vercel KV / Upstash Redis instead (same signature -> `seen`
// interface, drop-in swap).
const seenSignatures = new Map<string, number>();

/** Returns false if this exact signature was already used (a replay). */
export function checkAndRecordReplay(signature: string): boolean {
  if (seenSignatures.has(signature)) return false;
  seenSignatures.set(signature, Date.now());
  return true;
}

setInterval(() => {
  const cutoff = Date.now() - REPLAY_WINDOW_MS;
  for (const [sig, ts] of seenSignatures) {
    if (ts < cutoff) seenSignatures.delete(sig);
  }
}, 60 * 1000).unref?.();
