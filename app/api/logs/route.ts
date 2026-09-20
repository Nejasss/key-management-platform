import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { desc, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { apiError, apiSuccess } from '@/lib/security/api-response';

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return apiError('You must be logged in', 'UNAUTHORIZED');
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Number(searchParams.get('pageSize')) || 25);

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: schema.activityLogs.id,
        action: schema.activityLogs.action,
        ip: schema.activityLogs.ip,
        userAgent: schema.activityLogs.userAgent,
        metadata: schema.activityLogs.metadata,
        createdAt: schema.activityLogs.createdAt,
        licenseId: schema.activityLogs.licenseId,
        userEmail: schema.users.email,
      })
      .from(schema.activityLogs)
      .leftJoin(schema.users, sql`${schema.users.id} = ${schema.activityLogs.userId}`)
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.activityLogs),
  ]);

  return apiSuccess({
    data: rows,
    pagination: {
      page,
      pageSize,
      total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / pageSize),
    },
  });
}
