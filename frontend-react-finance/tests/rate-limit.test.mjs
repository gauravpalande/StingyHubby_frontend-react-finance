import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
let outputDirectory;
let rateLimit;

before(async () => {
  outputDirectory = await mkdtemp(join(tmpdir(), 'pennywize-rate-limit-test-'));
  await writeFile(join(outputDirectory, 'package.json'), '{"type":"module"}');
  await build({
    absWorkingDir: projectRoot,
    entryPoints: ['api/_lib/rateLimit.ts'],
    outdir: outputDirectory,
    bundle: false,
    platform: 'node',
    format: 'esm',
    target: 'node20',
  });
  rateLimit = await import(pathToFileURL(join(outputDirectory, 'rateLimit.js')).href);
});

after(async () => {
  if (outputDirectory) await rm(outputDirectory, { recursive: true, force: true });
});

const rule = { key: 'suggestions:user:test-user:hour', limit: 5, windowSeconds: 3600 };

function fakeSupabase(result) {
  const calls = [];
  return {
    calls,
    client: {
      async rpc(name, args) {
        calls.push({ name, args });
        return result;
      },
    },
  };
}

test('accepts an allowed counter result returned as a row array', async () => {
  const supabase = fakeSupabase({
    data: [{ allowed: true, remaining: 4, retry_after_seconds: 0 }],
    error: null,
  });

  await rateLimit.enforceRateLimits(supabase.client, [rule]);
  assert.deepEqual(supabase.calls, [{
    name: 'consume_api_rate_limit',
    args: { p_key: rule.key, p_limit: rule.limit, p_window_seconds: rule.windowSeconds },
  }]);
});

test('returns a finite retry delay for a denied counter result', async () => {
  const supabase = fakeSupabase({
    data: [{ allowed: false, remaining: 0, retry_after_seconds: 37 }],
    error: null,
  });

  await assert.rejects(
    rateLimit.enforceRateLimits(supabase.client, [rule]),
    (error) => error instanceof rateLimit.RateLimitExceededError
      && error.statusCode === 429
      && error.retryAfterSeconds === 37
  );
});

test('fails closed with a service error when the counter call fails', async () => {
  const supabase = fakeSupabase({ data: null, error: new Error('private database details') });

  await assert.rejects(
    rateLimit.enforceRateLimits(supabase.client, [rule]),
    (error) => error instanceof rateLimit.RateLimitUnavailableError && error.statusCode === 503
  );
});

for (const data of [
  null,
  [],
  {},
  { allowed: 'false', retry_after_seconds: 30 },
  { allowed: false },
  { allowed: false, retry_after_seconds: 0 },
  { allowed: false, retry_after_seconds: -1 },
  { allowed: false, retry_after_seconds: 1.5 },
  { allowed: false, retry_after_seconds: Number.NaN },
  { allowed: false, retry_after_seconds: '30' },
]) {
  test(`fails closed for malformed counter data ${JSON.stringify(data)}`, async () => {
    const supabase = fakeSupabase({ data, error: null });

    await assert.rejects(
      rateLimit.enforceRateLimits(supabase.client, [rule]),
      (error) => error instanceof rateLimit.RateLimitUnavailableError && error.statusCode === 503
    );
  });
}

test('hashes the first forwarded client address without returning the raw address', () => {
  const address = '203.0.113.10';
  const expected = createHash('sha256').update(address).digest('hex').slice(0, 32);

  assert.equal(rateLimit.getClientFingerprint({
    headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
  }), expected);
  assert.doesNotMatch(expected, /203\.0\.113\.10/);
});

test('uses the real IP header when forwarded-for is unavailable', () => {
  const address = '198.51.100.4';
  const expected = createHash('sha256').update(address).digest('hex').slice(0, 32);

  assert.equal(rateLimit.getClientFingerprint({ headers: { 'x-real-ip': address } }), expected);
  assert.equal(rateLimit.getClientFingerprint({ headers: {} }), null);
});
