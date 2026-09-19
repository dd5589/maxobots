import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { validateInitData } from '../src/api/validation.js';

const BOT_TOKEN = 'test-token-123';

function sign(params, token) {
  const launchParams = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(token)
    .digest();

  return crypto
    .createHmac('sha256', secretKey)
    .update(launchParams)
    .digest('hex');
}

function buildInitData({
  authDate = Math.floor(Date.now() / 1000),
  user = { id: 1, first_name: 'Иван' },
  startParam = 'smv_error',
} = {}) {
  const params = new URLSearchParams();

  params.set('user', JSON.stringify(user));
  params.set('auth_date', String(authDate));
  params.set('start_param', startParam);
  params.set('hash', sign(params, BOT_TOKEN));

  return params.toString();
}

test('валидная подпись проходит', () => {
  const initData = buildInitData();

  const result = validateInitData(initData, BOT_TOKEN);

  assert.equal(result.valid, true);
  assert.equal(result.user.id, 1);
  assert.equal(result.startParam, 'smv_error');
});

test('подделанная подпись отклоняется', () => {
  const initData = buildInitData();

  const params = new URLSearchParams(initData);
  params.set('hash', 'deadbeef');

  const result = validateInitData(
    params.toString(),
    BOT_TOKEN
  );

  assert.equal(result.valid, false);
  assert.equal(result.error, 'bad_signature');
});

test('просроченные данные отклоняются', () => {
  const oldAuthDate = Math.floor(Date.now() / 1000) - 7200;
  const initData = buildInitData({ authDate: oldAuthDate });

  const result = validateInitData(
    initData,
    BOT_TOKEN,
    { maxAgeSeconds: 3600 }
  );

  assert.equal(result.valid, false);
  assert.equal(result.error, 'expired_init_data');
});

test('пустая строка отклоняется', () => {
  assert.equal(
    validateInitData('', BOT_TOKEN).valid,
    false
  );

  assert.equal(
    validateInitData(null, BOT_TOKEN).valid,
    false
  );
});
