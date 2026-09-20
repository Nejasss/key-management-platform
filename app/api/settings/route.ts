import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { requireAdmin, requireUser } from '@/lib/auth/session';
import { apiError, apiSuccess } from '@/lib/security/api-response';
import { settingsSchema } from '@/lib/validation/schemas';

export async function GET() {
  try {
    await requireUser();
  } catch {
    return apiError('You must be logged in', 'UNAUTHORIZED');
  }

  let [settings] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.id, 1)).limit(1);
  if (!settings) {
    [settings] = await db.insert(schema.appSettings).values({ id: 1 }).returning();
  }
  return apiSuccess({ data: settings });
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return apiError('Admin access required', 'FORBIDDEN');
    }
    return apiError('You must be logged in', 'UNAUTHORIZED');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 'INVALID_REQUEST');
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid settings input', 'INVALID_REQUEST');
  }

  await db
    .insert(schema.appSettings)
    .values({ id: 1, ...parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.appSettings.id,
      set: { ...parsed.data, updatedAt: new Date() },
    });

  const [updated] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.id, 1)).limit(1);

  return apiSuccess({ data: updated, message: 'Settings updated' });
}
