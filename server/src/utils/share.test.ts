import { describe, expect, it } from 'vitest';
import { generateConfirmationCode, generateShareToken, getShareExpiry, isExpired } from './share';

describe('share utils', () => {
  it('generates confirmation code with 6 alphanumeric chars', () => {
    const code = generateConfirmationCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('generates unique-enough token with hex chars', () => {
    const tokenA = generateShareToken();
    const tokenB = generateShareToken();
    expect(tokenA).toMatch(/^[a-f0-9]+$/);
    expect(tokenA).not.toBe(tokenB);
  });

  it('creates expiry around 30 minutes by default', () => {
    const now = Date.now();
    const expiry = getShareExpiry().getTime();
    const diffMinutes = (expiry - now) / 1000 / 60;
    expect(diffMinutes).toBeGreaterThan(29);
    expect(diffMinutes).toBeLessThan(31);
  });

  it('detects expiration correctly', () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    expect(isExpired(past)).toBe(true);
    expect(isExpired(future)).toBe(false);
  });
});
