import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'LICENSE_INVALID'
  | 'LICENSE_EXPIRED'
  | 'LICENSE_REVOKED'
  | 'DEVICE_LIMIT_REACHED';

const CODE_TO_STATUS: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  LICENSE_INVALID: 200, // verify endpoint always returns 200 with valid:false
  LICENSE_EXPIRED: 200,
  LICENSE_REVOKED: 200,
  DEVICE_LIMIT_REACHED: 200,
};

export function apiError(message: string, code: ErrorCode, status?: number) {
  return NextResponse.json(
    { success: false, message, code },
    { status: status ?? CODE_TO_STATUS[code] }
  );
}

export function apiSuccess<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

/** Never include these fields in any API response, ever. */
const FORBIDDEN_FIELDS = [
  'password',
  'passwordHash',
  'password_hash',
  'tokenHash',
  'token_hash',
  'DATABASE_URL',
  'AUTH_SECRET',
];

export function stripSensitive<T extends Record<string, unknown>>(obj: T): T {
  const clone = { ...obj };
  for (const field of FORBIDDEN_FIELDS) {
    delete (clone as Record<string, unknown>)[field];
  }
  return clone;
}
