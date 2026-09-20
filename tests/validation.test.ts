import { describe, it, expect } from 'vitest';
import { verifySchema, generateKeySchema, loginSchema } from '@/lib/validation/schemas';

describe('verifySchema (API validation test)', () => {
  it('accepts a valid verify payload', () => {
    const result = verifySchema.safeParse({ key: 'CAINTXS-AB12CD-EF34GH-IJ56KL', device_id: 'device-123' });
    expect(result.success).toBe(true);
  });

  it('rejects a payload missing device_id', () => {
    const result = verifySchema.safeParse({ key: 'CAINTXS-AB12CD-EF34GH-IJ56KL' });
    expect(result.success).toBe(false);
  });

  it('rejects a payload with an empty key', () => {
    const result = verifySchema.safeParse({ key: '', device_id: 'device-123' });
    expect(result.success).toBe(false);
  });
});

describe('generateKeySchema', () => {
  it('applies sensible defaults', () => {
    const result = generateKeySchema.parse({});
    expect(result.quantity).toBe(1);
    expect(result.maxDevices).toBe(1);
    expect(result.autoActivate).toBe(true);
  });

  it('rejects quantity above the bulk cap', () => {
    const result = generateKeySchema.safeParse({ quantity: 5000 });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires a valid email format', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'x' });
    expect(result.success).toBe(false);
  });
});
