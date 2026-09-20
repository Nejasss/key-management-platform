import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/session';
import { apiError, apiSuccess } from '@/lib/security/api-response';

export async function GET(_req: NextRequest) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return apiError('Admin access required', 'FORBIDDEN');
    }
    return apiError('You must be logged in', 'UNAUTHORIZED');
  }

  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      username: schema.users.username,
      role: schema.users.role,
      isActive: schema.users.isActive,
      createdAt: schema.users.createdAt,
      lastLoginAt: schema.users.lastLoginAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt));

  return apiSuccess({ data: rows });
}
