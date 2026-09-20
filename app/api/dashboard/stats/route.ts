import { db, schema } from '@/db';
import { sql, gte } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { apiError, apiSuccess } from '@/lib/security/api-response';

export async function GET() {
  try {
    await requireUser();
  } catch {
    return apiError('You must be logged in', 'UNAUTHORIZED');
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalKeys,
    activeKeys,
    expiredKeys,
    revokedKeys,
    usedDevices,
    totalUsers,
    keysToday,
    verificationsToday,
    recentActivity,
    dailyGeneration,
    dailyVerifications,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(schema.licenses),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.licenses).where(sql`${schema.licenses.status} = 'active'`),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.licenses).where(sql`${schema.licenses.status} = 'expired'`),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.licenses).where(sql`${schema.licenses.status} = 'revoked'`),
    db.select({ count: sql<number>`count(distinct ${schema.licenseDevices.deviceId})::int` }).from(schema.licenseDevices),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.users),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.licenses).where(gte(schema.licenses.createdAt, todayStart)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.activityLogs)
      .where(sql`${schema.activityLogs.action} in ('verification_request','verification_failed') and ${schema.activityLogs.createdAt} >= ${todayStart}`),
    db
      .select({
        id: schema.activityLogs.id,
        action: schema.activityLogs.action,
        createdAt: schema.activityLogs.createdAt,
        userEmail: schema.users.email,
      })
      .from(schema.activityLogs)
      .leftJoin(schema.users, sql`${schema.users.id} = ${schema.activityLogs.userId}`)
      .orderBy(sql`${schema.activityLogs.createdAt} desc`)
      .limit(10),
    db.execute(sql`
      select to_char(d.day, 'YYYY-MM-DD') as date, coalesce(count(l.id), 0)::int as count
      from generate_series(current_date - interval '13 days', current_date, interval '1 day') as d(day)
      left join ${schema.licenses} l on date_trunc('day', l.created_at) = d.day
      group by d.day order by d.day
    `),
    db.execute(sql`
      select to_char(d.day, 'YYYY-MM-DD') as date, coalesce(count(a.id), 0)::int as count
      from generate_series(current_date - interval '13 days', current_date, interval '1 day') as d(day)
      left join ${schema.activityLogs} a on date_trunc('day', a.created_at) = d.day and a.action in ('verification_request','verification_failed')
      group by d.day order by d.day
    `),
  ]);

  return apiSuccess({
    data: {
      totalKeys: totalKeys[0]?.count ?? 0,
      activeKeys: activeKeys[0]?.count ?? 0,
      expiredKeys: expiredKeys[0]?.count ?? 0,
      revokedKeys: revokedKeys[0]?.count ?? 0,
      usedDevices: usedDevices[0]?.count ?? 0,
      totalUsers: totalUsers[0]?.count ?? 0,
      keysToday: keysToday[0]?.count ?? 0,
      verificationsToday: verificationsToday[0]?.count ?? 0,
      recentActivity,
      dailyGeneration: dailyGeneration.rows ?? dailyGeneration,
      dailyVerifications: dailyVerifications.rows ?? dailyVerifications,
    },
  });
}
