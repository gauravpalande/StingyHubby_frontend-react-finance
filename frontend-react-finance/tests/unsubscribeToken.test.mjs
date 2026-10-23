import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnsubscribeToken, verifyUnsubscribeToken } from '../api/_lib/unsubscribeToken.mjs';

const secret = 'a'.repeat(48);
const id = '123e4567-e89b-42d3-a456-426614174000';
const now = Date.UTC(2026, 9, 23);
test('valid token verifies only for the intended user', () => {
  assert.equal(verifyUnsubscribeToken(createUnsubscribeToken(id, secret, now), secret, now), id);
});
test('tampered token is rejected', () => {
  const token = createUnsubscribeToken(id, secret, now);
  assert.equal(verifyUnsubscribeToken(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'), secret, now), null);
});
test('expired and future tokens are rejected', () => {
  const token = createUnsubscribeToken(id, secret, now);
  assert.equal(verifyUnsubscribeToken(token, secret, now + 31 * 86400000), null);
  assert.equal(verifyUnsubscribeToken(token, secret, now - 1000), null);
});
test('missing or malformed tokens are rejected', () => {
  assert.equal(verifyUnsubscribeToken(undefined, secret, now), null);
  assert.equal(verifyUnsubscribeToken('bad', secret, now), null);
  assert.throws(() => createUnsubscribeToken('not-a-uuid', secret, now));
});
