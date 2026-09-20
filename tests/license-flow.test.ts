import { describe, it, expect, beforeAll } from 'vitest';

/**
 * These tests exercise the real verification flow against a live Neon
 * database, so they only run when DATABASE_URL is configured (e.g. in
 * CI with a disposable test database branch). They are skipped
 * automatically otherwise so `npm test` still works out of the box.
 *
 * Run with: DATABASE_URL=... npm test
 */
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('license verification flow (integration)', () => {
  let db: typeof import('@/db').db;
  let schema: typeof import('@/db').schema;
  let verifyLicenseKey: typeof import('@/lib/license/verify').verifyLicenseKey;
  beforeAll(async () => {
    ({ db, schema } = await import('@/db'));
    ({ verifyLicenseKey } = await import('@/lib/license/verify'));
  });

  // Note: this suite is meant to run against a disposable/test database
  // branch, so generated TEST-* rows are left in place rather than
  // individually cleaned up here.

  it('binds a new device on first verification (device binding test)', async () => {
    const [license] = await db
      .insert(schema.licenses)
      .values({ key: `TEST-BIND-${Date.now()}`, prefix: 'TEST', status: 'active', maxDevices: 1 })
      .returning();
    const result = await verifyLicenseKey(license.key, 'device-a', {});
    expect(result.valid).toBe(true);
    expect(result.deviceBound).toBe(true);
  });

  it('rejects a second device once max_devices=1 is reached (max device test)', async () => {
    const [license] = await db
      .insert(schema.licenses)
      .values({ key: `TEST-MAX-${Date.now()}`, prefix: 'TEST', status: 'active', maxDevices: 1 })
      .returning();

    const first = await verifyLicenseKey(license.key, 'device-a', {});
    expect(first.valid).toBe(true);

    const second = await verifyLicenseKey(license.key, 'device-b', {});
    expect(second.valid).toBe(false);
    expect(second.code).toBe('device_limit_reached');
  });

  it('rejects a revoked key (revoked key test)', async () => {
    const [license] = await db
      .insert(schema.licenses)
      .values({ key: `TEST-REVOKED-${Date.now()}`, prefix: 'TEST', status: 'revoked', maxDevices: 1 })
      .returning();

    const result = await verifyLicenseKey(license.key, 'device-a', {});
    expect(result.valid).toBe(false);
    expect(result.code).toBe('revoked');
  });

  it('rejects an expired key (expired key test)', async () => {
    const [license] = await db
      .insert(schema.licenses)
      .values({
        key: `TEST-EXPIRED-${Date.now()}`,
        prefix: 'TEST',
        status: 'active',
        maxDevices: 1,
        expiresAt: new Date(Date.now() - 86400000),
      })
      .returning();

    const result = await verifyLicenseKey(license.key, 'device-a', {});
    expect(result.valid).toBe(false);
    expect(result.code).toBe('expired');
  });

  it('returns not_found for a key that does not exist (invalid key test)', async () => {
    const result = await verifyLicenseKey('DOES-NOT-EXIST-000000', 'device-a', {});
    expect(result.valid).toBe(false);
    expect(result.code).toBe('not_found');
  });
});
