import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
let outputDirectory;

before(async () => {
  outputDirectory = await mkdtemp(join(tmpdir(), 'pennywize-api-test-'));
  await writeFile(join(outputDirectory, 'package.json'), '{"type":"module"}');
  await symlink(join(projectRoot, 'node_modules'), join(outputDirectory, 'node_modules'), 'dir');

  // Keep imports intact: bundling would hide the ESM resolution error seen on Vercel.
  await build({
    absWorkingDir: projectRoot,
    entryPoints: ['api/generate-suggestions.ts', 'api/portal.ts', 'api/_lib/rateLimit.ts'],
    outbase: 'api',
    outdir: outputDirectory,
    bundle: false,
    platform: 'node',
    format: 'esm',
    target: 'node20',
  });
});

after(async () => {
  if (outputDirectory) await rm(outputDirectory, { recursive: true, force: true });
});

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

for (const route of ['generate-suggestions', 'portal']) {
  test(`${route} starts as native ESM and rejects GET with JSON`, async () => {
    const { default: handler } = await import(pathToFileURL(join(outputDirectory, `${route}.js`)).href);
    const response = createResponse();

    await handler({ method: 'GET', headers: {} }, response);

    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.Allow, 'POST');
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.deepEqual(response.body, { error: 'Method not allowed' });
  });

  test(`${route} rejects unauthenticated POST without calling external services`, async (context) => {
    const { default: handler } = await import(pathToFileURL(join(outputDirectory, `${route}.js`)).href);
    const fetchMock = context.mock.method(globalThis, 'fetch', () => {
      throw new Error('Unauthenticated requests must not call external services');
    });
    const response = createResponse();

    await handler({ method: 'POST', headers: { 'content-type': 'application/json' }, body: {} }, response);

    assert.equal(response.statusCode, 401);
    assert.match(response.body.error, /logged in/);
    assert.equal(fetchMock.mock.callCount(), 0);
  });
}
