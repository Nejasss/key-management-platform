import { db, schema } from '@/db';
import { eq, and } from 'drizzle-orm';

export type VerifyResultCode =
  | 'valid'
  | 'not_found'
  | 'revoked'
  | 'expired'
  | 'device_limit_reached';

export interface VerifyResult {
  code: VerifyResultCode;
  valid: boolean;
  license?: typeof schema.licenses.$inferSelect;
  deviceBound: boolean;
}

/**
 * Full verification flow per spec:
 * 1. Look up key.
 * 2. Not found -> invalid.
 * 3. Revoked -> invalid.
 * 4. Expired -> invalid (and auto-transitions status to 'expired').
 * 5. Active/unused -> check device binding, bind if slot available.
 * 6. Update last_verified_at.
 */
export async function verifyLicenseKey(
  key: string,
  deviceId: string,
  meta: { ip?: string | null; userAgent?: string | null }
): Promise<VerifyResult> {
  const [license] = await db
    .select()
    .from(schema.licenses)
    .where(eq(schema.licenses.key, key))
    .limit(1);

  if (!license) {
    return { code: 'not_found', valid: false, deviceBound: false };
  }

  if (license.status === 'revoked') {
    return { code: 'revoked', valid: false, license, deviceBound: false };
  }

  const now = new Date();
  const isExpiredByDate = license.expiresAt ? license.expiresAt.getTime() < now.getTime() : false;

  if (license.status === 'expired' || isExpiredByDate) {
    if (isExpiredByDate && license.status !== 'expired') {
      await db
        .update(schema.licenses)
        .set({ status: 'expired', updatedAt: now })
        .where(eq(schema.licenses.id, license.id));
    }
    return { code: 'expired', valid: false, license, deviceBound: false };
  }

  // status is 'active' or 'unused' at this point
  const [existingDevice] = await db
    .select()
    .from(schema.licenseDevices)
    .where(
      and(
        eq(schema.licenseDevices.licenseId, license.id),
        eq(schema.licenseDevices.deviceId, deviceId)
      )
    )
    .limit(1);

  let deviceBound = false;

  if (existingDevice) {
    deviceBound = true;
    await db
      .update(schema.licenseDevices)
      .set({ lastSeenAt: now, ip: meta.ip ?? existingDevice.ip, userAgent: meta.userAgent ?? existingDevice.userAgent })
      .where(eq(schema.licenseDevices.id, existingDevice.id));
  } else {
    if (license.maxDevices !== -1) {
      const boundDevices = await db
        .select({ id: schema.licenseDevices.id })
        .from(schema.licenseDevices)
        .where(eq(schema.licenseDevices.licenseId, license.id));

      if (boundDevices.length >= license.maxDevices) {
        return { code: 'device_limit_reached', valid: false, license, deviceBound: false };
      }
    }

    await db.insert(schema.licenseDevices).values({
      licenseId: license.id,
      deviceId,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
    deviceBound = true;
  }

  const [updated] = await db
    .update(schema.licenses)
    .set({
      status: 'active',
      lastVerifiedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.licenses.id, license.id))
    .returning();

  return { code: 'valid', valid: true, license: updated, deviceBound };
}
