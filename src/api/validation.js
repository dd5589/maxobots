import crypto from 'node:crypto';

function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const entries = [...params.entries()];
  const counts = new Map();

  for (const [key] of entries) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const duplicatedKey = [...counts.entries()].find(([, count]) => count !== 1);

  if (duplicatedKey) {
    return {
      ok: false,
      error: 'duplicate_param',
    };
  }

  const hash = params.get('hash');

  if (!hash) {
    return {
      ok: false,
      error: 'missing_hash',
    };
  }

  params.delete('hash');

  const launchParams = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  return {
    ok: true,
    params,
    hash,
    launchParams,
  };
}

function timingSafeHexEqual(expectedHex, actualHex) {
  if (!/^[0-9a-f]{64}$/i.test(expectedHex)) {
    return false;
  }

  if (!/^[0-9a-f]{64}$/i.test(actualHex)) {
    return false;
  }

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(actualHex, 'hex');

  return crypto.timingSafeEqual(expected, actual);
}

export function validateInitData(
  initData,
  botToken,
  {
    maxAgeSeconds = 3600,
    nowSeconds = Math.floor(Date.now() / 1000),
  } = {}
) {
  if (!initData || typeof initData !== 'string') {
    return {
      valid: false,
      error: 'empty_init_data',
    };
  }

  if (!botToken || typeof botToken !== 'string') {
    return {
      valid: false,
      error: 'empty_bot_token',
    };
  }

  let parsed;

  try {
    parsed = parseInitData(initData);
  } catch {
    return {
      valid: false,
      error: 'malformed_init_data',
    };
  }

  if (!parsed.ok) {
    return {
      valid: false,
      error: parsed.error,
    };
  }

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(parsed.launchParams)
    .digest('hex');

  if (!timingSafeHexEqual(calculatedHash, parsed.hash)) {
    return {
      valid: false,
      error: 'bad_signature',
    };
  }

  const authDate = Number(parsed.params.get('auth_date'));

  if (!Number.isInteger(authDate) || authDate <= 0) {
    return {
      valid: false,
      error: 'bad_auth_date',
    };
  }

  if (maxAgeSeconds > 0) {
    const age = Math.abs(nowSeconds - authDate);

    if (age > maxAgeSeconds) {
      return {
        valid: false,
        error: 'expired_init_data',
      };
    }
  }

  let user = null;
  const userRaw = parsed.params.get('user');

  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      return {
        valid: false,
        error: 'bad_user_json',
      };
    }
  }

  if (!user || (user.id == null && user.user_id == null)) {
    return {
      valid: false,
      error: 'user_missing',
    };
  }

  return {
    valid: true,
    user,
    authDate,
    startParam: parsed.params.get('start_param') ?? '',
  };
}
