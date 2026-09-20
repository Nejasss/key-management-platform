import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password hashing', () => {
  it('hashes a password and verifies it correctly (login test)', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    const ok = await verifyPassword('correct-horse-battery-staple', hash);
    expect(ok).toBe(true);
  });

  it('rejects an incorrect password (invalid login test)', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    const ok = await verifyPassword('wrong-password', hash);
    expect(ok).toBe(false);
  });

  it('never stores the plaintext password in the hash', async () => {
    const plain = 'super-secret-value';
    const hash = await hashPassword(plain);
    expect(hash).not.toContain(plain);
  });
});
