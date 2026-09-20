import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startApiServer } from '../src/api/server.js';

let server;
let baseUrl;

before(async () => {
  server = startApiServer({
    port: 0,
    host: '127.0.0.1',
    authenticate: () => ({ id: 'test-user' }),
  });
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('GET /health возвращает ok и no-store', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('GET /api/meta возвращает public cache', async () => {
  const response = await fetch(`${baseUrl}/api/meta`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
  const body = await response.json();
  assert.ok(body.version);
  assert.ok(Array.isArray(body.sources));
});


test('защищённый endpoint без initData возвращает 401', async () => {
  const protectedServer = startApiServer({ port: 0, host: '127.0.0.1' });
  await new Promise((resolve) => protectedServer.once('listening', resolve));

  try {
    const address = protectedServer.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/reason/smv_error`);
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error, 'invalid_init_data');
  } finally {
    await new Promise((resolve, reject) => {
      protectedServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('защищённый endpoint проходит через auth middleware', async () => {
  const response = await fetch(`${baseUrl}/api/reason/smv_error`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.id, 'smv_error');
});

test('checklist endpoint возвращает ожидаемый контракт', async () => {
  const response = await fetch(`${baseUrl}/api/checklist/smv_error`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.reasonId, 'smv_error');
  assert.ok(Array.isArray(body.steps));
  assert.ok(Array.isArray(body.documents));
});

test('неизвестный endpoint возвращает 404', async () => {
  const response = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'not_found' });
});

test('метод POST для GET endpoint возвращает 405', async () => {
  const response = await fetch(`${baseUrl}/health`, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, OPTIONS');
});

test('OPTIONS возвращает CORS preflight', async () => {
  const response = await fetch(`${baseUrl}/api/meta`, { method: 'OPTIONS' });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
});
