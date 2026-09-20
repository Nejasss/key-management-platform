import { randomBytes, createHash } from 'crypto';
import { cookies } from 'next/headers';
import { db, schema } from '@/db';
import { eq, and, gt } from 'drizzle-orm';

export const SESSION_COOKIE_NAME = 'kmp_session';
const DEFAULT_SESSION_DAYS = 7;
const REMEMBER_SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createSession(userId: string, remember = false) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const days = remember ? REMEMBER_SESSION_DAYS : DEFAULT_SESSION_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await db.insert(schema.sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return { token, expiresAt };
}

export async function getSessionUser() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = new Date();

  const rows = await db
    .select({
      userId: schema.sessions.userId,
      expiresAt: schema.sessions.expiresAt,
      role: schema.users.role,
      email: schema.users.email,
      username: schema.users.username,
      isActive: schema.users.isActive,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, tokenHash), gt(schema.sessions.expiresAt, now)))
    .limit(1);

  const session = rows[0];
  if (!session || !session.isActive) return null;

  return {
    id: session.userId,
    email: session.email,
    username: session.username,
    role: session.role,
  };
}

export async function destroySession() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash));
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }
  return user;
}
