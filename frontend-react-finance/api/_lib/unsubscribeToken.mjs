import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createUnsubscribeToken(userId, secret, now = Date.now()) {
  if (!UUID.test(userId) || !secret || secret.length < 32) throw new Error('Invalid unsubscribe configuration');
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: Math.floor(now / 1000) })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyUnsubscribeToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 512 || !secret || secret.length < 32) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  const expected = createHmac('sha256', secret).update(parts[0]).digest();
  const supplied = Buffer.from(parts[1], 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const { userId, issuedAt } = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const age = Math.floor(now / 1000) - issuedAt;
    return UUID.test(userId) && Number.isInteger(issuedAt) && age >= 0 && age <= MAX_AGE_SECONDS ? userId : null;
  } catch { return null; }
}
