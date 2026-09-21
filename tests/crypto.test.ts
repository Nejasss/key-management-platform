import { describe, it, expect, beforeAll } from 'vitest';

// The crypto module reads its keys from env vars at call time, so set
// them before importing anything that touches them.
beforeAll(() => {
  process.env.API_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.API_HMAC_SECRET = 'test-hmac-secret-do-not-use-in-prod';
});

describe('encrypt/decrypt roundtrip', () => {
  it('decrypts back to the original plaintext', async () => {
    const { encryptPayload, decryptPayload } = await import('@/lib/security/crypto');
    const plaintext = JSON.stringify({ key: 'TEST-1234-5678', device_id: 'device-abc' });
    const envelope = encryptPayload(plaintext);
    expect(decryptPayload(envelope)).toBe(plaintext);
  });

  it('produces a different ciphertext and IV each time (no IV reuse)', async () => {
    const { encryptPayload } = await import('@/lib/security/crypto');
    const a = encryptPayload('same plaintext');
    const b = encryptPayload('same plaintext');
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('rejects a tampered ciphertext (GCM auth tag check)', async () => {
    const { encryptPayload, decryptPayload } = await import('@/lib/security/crypto');
    const envelope = encryptPayload('{"valid":false}');
    // Flip a character in the ciphertext to simulate tampering.
    const tampered = { ...envelope, data: envelope.data.slice(0, -4) + 'AAAA' };
    expect(() => decryptPayload(tampered)).toThrow();
  });
});

describe('HMAC signing', () => {
  it('verifies a signature it produced itself', async () => {
    const { signPayload, verifySignature } = await import('@/lib/security/crypto');
    const timestamp = Date.now().toString();
    const body = '{"iv":"a","tag":"b","data":"c"}';
    const signature = signPayload(timestamp, body);
    expect(verifySignature(timestamp, body, signature)).toBe(true);
  });

  it('rejects a signature for a different body (tamper detection)', async () => {
    const { signPayload, verifySignature } = await import('@/lib/security/crypto');
    const timestamp = Date.now().toString();
    const signature = signPayload(timestamp, 'original body');
    expect(verifySignature(timestamp, 'tampered body', signature)).toBe(false);
  });

  it('rejects a garbage signature without throwing', async () => {
    const { verifySignature } = await import('@/lib/security/crypto');
    expect(verifySignature(Date.now().toString(), 'body', 'not-hex-garbage')).toBe(false);
  });
});

describe('replay protection', () => {
  it('accepts a signature the first time and rejects it on reuse', async () => {
    const { checkAndRecordReplay } = await import('@/lib/security/crypto');
    const signature = `unique-sig-${Date.now()}-${Math.random()}`;
    expect(checkAndRecordReplay(signature)).toBe(true);
    expect(checkAndRecordReplay(signature)).toBe(false);
  });
});

describe('isTimestampFresh', () => {
  it('accepts the current time', async () => {
    const { isTimestampFresh } = await import('@/lib/security/crypto');
    expect(isTimestampFresh(Date.now().toString())).toBe(true);
  });

  it('rejects a timestamp far in the past', async () => {
    const { isTimestampFresh } = await import('@/lib/security/crypto');
    expect(isTimestampFresh((Date.now() - 60 * 60 * 1000).toString())).toBe(false);
  });

  it('rejects a non-numeric timestamp', async () => {
    const { isTimestampFresh } = await import('@/lib/security/crypto');
    expect(isTimestampFresh('not-a-number')).toBe(false);
  });
});
