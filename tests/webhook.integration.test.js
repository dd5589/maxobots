import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';

import { Bot } from '@maxhub/max-bot-api';
import { createBot } from '../src/bot/runtime.js';

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

function mockMaxFetch() {
  const calls = [];

  return {
    calls,
    fetch: async (input, init = {}) => {
      const url = String(input);
      const method = init.method ?? 'GET';
      calls.push({ url, method, body: init.body ? JSON.parse(init.body) : null });

      if (url.endsWith('/me')) {
        return new Response(JSON.stringify({
          user_id: 999,
          username: 'integration_test_bot',
          name: 'Integration Test Bot',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }

      if (url.endsWith('/subscriptions') && method === 'GET') {
        return new Response(JSON.stringify({ subscriptions: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }

      if (url.endsWith('/subscriptions') && method === 'POST') {
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }

      if (url.endsWith('/me/commands') && method === 'PATCH') {
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }

      if (url.includes('/subscriptions?') && method === 'DELETE') {
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }

      throw new Error(`Unexpected MAX API call in integration test: ${method} ${url}`);
    },
  };
}

function postJson(port, path, headers, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end(JSON.stringify(payload));
  });
}

test('MAX SDK webhook: подписка, secret-check и обработка update работают через реальный HTTP callback', async () => {
  const port = await getFreePort();
  const mocked = mockMaxFetch();
  const bot = createBot({
    token: 'integration-test-token',
    clientOptions: { fetch: mocked.fetch },
  });

  const received = [];
  bot.on('bot_started', async (ctx) => {
    received.push(ctx.startPayload);
  });

  await bot.start({
    mode: 'webhook',
    options: {
      domain: 'https://integration.example',
      path: '/webhook',
      secret: 'test_secret',
      port,
      allowedUpdates: ['bot_started'],
    },
  });

  try {
    const unauthorized = await postJson(
      port,
      '/webhook',
      { 'X-Max-Bot-Api-Secret': 'wrong_secret' },
      { update_type: 'bot_started', timestamp: Date.now(), payload: 'denied' },
    );
    assert.equal(unauthorized.status, 404);

    const authorized = await postJson(
      port,
      '/webhook',
      { 'X-Max-Bot-Api-Secret': 'test_secret' },
      {
        update_type: 'bot_started',
        timestamp: Date.now(),
        user: { user_id: 123, name: 'Test User' },
        payload: 'accepted',
      },
    );
    assert.equal(authorized.status, 200);

    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.deepEqual(received, ['accepted']);

    const subscription = mocked.calls.find((call) => call.method === 'POST' && call.url.endsWith('/subscriptions'));
    assert.ok(subscription, 'MAX subscription was not created');
    assert.equal(subscription.body.url, 'https://integration.example/webhook');
    assert.equal(subscription.body.secret, 'test_secret');
  } finally {
    await bot.stopWebhook();
  }

  // Ensure the test exercised the actual SDK Bot implementation, not a local HTTP stub.
  assert.equal(bot instanceof Bot, true);
  assert.equal(typeof bot.start, 'function');
});
