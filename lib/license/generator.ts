import { randomBytes } from 'crypto';

// Excludes 0/O and 1/I to avoid ambiguity, as required.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a cryptographically secure random string of the given length
 * using the safe alphabet (no 0/O or 1/I confusion).
 */
function secureRandomString(length: number): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    // Rejection-free mapping via modulo is fine here since ALPHABET.length (32)
    // divides 256 evenly, avoiding modulo bias.
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

export interface GenerateKeyOptions {
  prefix?: string;
  segments?: number; // number of dash-separated segments after the prefix
  segmentLength?: number; // characters per segment
}

/**
 * Generates a single license key in the format:
 * PREFIX-XXXXXX-XXXXXX-XXXXXX
 *
 * Uses Node's crypto.randomBytes (CSPRNG) — never Math.random().
 */
export function generateLicenseKey(options: GenerateKeyOptions = {}): string {
  const { prefix = 'LICENSE', segments = 3, segmentLength = 6 } = options;

  const parts: string[] = [prefix.toUpperCase()];
  for (let i = 0; i < segments; i++) {
    parts.push(secureRandomString(segmentLength));
  }
  return parts.join('-');
}

/**
 * Generates `count` unique license keys. Collision-checking against a
 * provided set of already-existing keys (e.g. freshly queried from DB)
 * plus in-batch collisions. The database also enforces a unique
 * constraint on licenses.key as a final safety net.
 */
export function generateBulkKeys(
  count: number,
  options: GenerateKeyOptions = {},
  existingKeys: Set<string> = new Set()
): string[] {
  const generated = new Set<string>();
  // Safety cap on attempts to avoid infinite loop in pathological cases.
  const maxAttempts = count * 50 + 1000;
  let attempts = 0;

  while (generated.size < count && attempts < maxAttempts) {
    attempts++;
    const key = generateLicenseKey(options);
    if (!existingKeys.has(key) && !generated.has(key)) {
      generated.add(key);
    }
  }

  if (generated.size < count) {
    throw new Error('Failed to generate enough unique keys, try again.');
  }

  return Array.from(generated);
}

/** Basic structural validation for a key before hitting the database. */
export function isPlausibleKeyFormat(key: string): boolean {
  return /^[A-Z0-9]+(-[A-Z0-9]+)+$/.test(key) && key.length <= 64;
}
