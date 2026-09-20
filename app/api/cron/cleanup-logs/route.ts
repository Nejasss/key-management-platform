import { NextRequest, NextResponse } from 'next/server';
import { lt } from 'drizzle-orm';
import { db, schema } from '@/db';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const cutoff = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    );

    const result = await db
      .delete(schema.activityLogs)
      .where(lt(schema.activityLogs.createdAt, cutoff))
      .returning({ id: schema.activityLogs.id });

    return NextResponse.json({
      success: true,
      deleted: result.length,
      cutoff: cutoff.toISOString(),
    });
  } catch (error) {
    console.error('Cleanup failed:', error);

    return NextResponse.json(
      { success: false, message: 'Cleanup failed' },
      { status: 500 }
    );
  }
}