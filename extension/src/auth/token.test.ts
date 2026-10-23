import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isExpired, tokenEmail, tokenExpiry } from './token.ts';

function jwtWith(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const NOW = new Date('2026-10-22T12:00:00Z');
const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

test('reads exp from the payload', () => {
  assert.deepEqual(tokenExpiry(jwtWith({ exp: seconds(NOW) })), NOW);
});

test('valid until shortly before exp', () => {
  assert.equal(isExpired(jwtWith({ exp: seconds(NOW) + 3600 }), NOW), false);
  assert.equal(isExpired(jwtWith({ exp: seconds(NOW) + 10 }), NOW), true); // inside the 30 s skew
  assert.equal(isExpired(jwtWith({ exp: seconds(NOW) - 60 }), NOW), true);
});

test('reads the email claim', () => {
  assert.equal(tokenEmail(jwtWith({ email: 'ada@example.com', exp: 1 })), 'ada@example.com');
  assert.equal(tokenEmail(jwtWith({ sub: 'x' })), undefined);
  assert.equal(tokenEmail('not-a-jwt'), undefined);
});

test('malformed or exp-less tokens count as expired', () => {
  assert.equal(isExpired('not-a-jwt', NOW), true);
  assert.equal(isExpired('a.%%%.c', NOW), true);
  assert.equal(isExpired(jwtWith({ sub: 'x' }), NOW), true);
  assert.equal(isExpired(jwtWith({ exp: 'soon' }), NOW), true);
});
