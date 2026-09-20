import { db, schema } from '@/db';

export type ActivityAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'generate_key'
  | 'revoke_key'
  | 'delete_key'
  | 'update_key'
  | 'reset_device'
  | 'verification_request'
  | 'verification_failed'
  | 'user_modification';

export async function logActivity(params: {
  userId?: string | null;
  action: ActivityAction;
  licenseId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.insert(schema.activityLogs).values({
      userId: params.userId ?? null,
      action: params.action,
      licenseId: params.licenseId ?? null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    // Activity logging must never break the primary request flow.
    console.error('Failed to write activity log:', err);
  }
}
