import crypto from 'crypto';

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateShareToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function generateConfirmationCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

export function isExpired(date: Date): boolean {
  return date.getTime() < Date.now();
}

export function getShareExpiry(minutes = 30): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry;
}
