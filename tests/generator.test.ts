import { describe, it, expect } from 'vitest';
import { generateLicenseKey, generateBulkKeys, isPlausibleKeyFormat } from '@/lib/license/generator';

describe('generateLicenseKey', () => {
  it('produces the default PREFIX-XXXXXX-XXXXXX-XXXXXX shape', () => {
    const key = generateLicenseKey({ prefix: 'CAINTXS' });
    expect(key).toMatch(/^CAINTXS-[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}$/);
  });

  it('never contains ambiguous characters 0/O or 1/I', () => {
    for (let i = 0; i < 200; i++) {
      const key = generateLicenseKey({ prefix: 'TEST' });
      expect(key).not.toMatch(/[01OI]/);
    }
  });

  it('respects custom segments and segment length', () => {
    const key = generateLicenseKey({ prefix: 'X', segments: 2, segmentLength: 4 });
    const parts = key.split('-');
    expect(parts.length).toBe(3); // prefix + 2 segments
    expect(parts[1]).toHaveLength(4);
    expect(parts[2]).toHaveLength(4);
  });
});

describe('generateBulkKeys', () => {
  it('generates the requested number of unique keys', () => {
    const keys = generateBulkKeys(100, { prefix: 'BULK' });
    expect(keys.length).toBe(100);
    expect(new Set(keys).size).toBe(100);
  });

  it('avoids keys already present in the provided existing set', () => {
    const existing = new Set(['TEST-AAAAAA-AAAAAA-AAAAAA']);
    const keys = generateBulkKeys(50, { prefix: 'TEST' }, existing);
    for (const k of keys) {
      expect(existing.has(k)).toBe(false);
    }
  });
});

describe('isPlausibleKeyFormat', () => {
  it('accepts well-formed keys', () => {
    expect(isPlausibleKeyFormat('CAINTXS-AB12CD-EF34GH-IJ56KL')).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isPlausibleKeyFormat('not a key')).toBe(false);
    expect(isPlausibleKeyFormat('')).toBe(false);
    expect(isPlausibleKeyFormat('NODASH')).toBe(false);
  });
});
