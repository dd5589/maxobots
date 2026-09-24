const required = (name, fallback = '') => {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Не задана переменная ${name}`);
  return value;
};

const token = required('BOT_TOKEN');
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const webhookPath = process.env.MAX_WEBHOOK_PATH || '/webhook';
const webhookSecret = required('MAX_WEBHOOK_SECRET');
const maxApiBase = 'https://platform-api2.max.ru';

async function maxApi(path, options = {}) {
  const response = await fetch(`${maxApiBase}${path}`, {
    ...options,
    headers: { Authorization: token, ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    throw new Error(`MAX API ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

if (!publicBaseUrl) {
  throw new Error('Нужен PUBLIC_BASE_URL или RENDER_EXTERNAL_URL для проверки Webhook');
}

console.log('1/4 MAX /me');
const me = await maxApi('/me');
console.log(`   OK: @${me.username || me.name || me.user_id}`);

console.log('2/4 MAX webhook subscriptions');
const subscriptionsResponse = await maxApi('/subscriptions');
const subscriptions = subscriptionsResponse?.subscriptions ?? [];
const expectedWebhook = `${publicBaseUrl}${webhookPath}`;
const active = subscriptions.find((item) => item.url === expectedWebhook);
if (!active) {
  throw new Error(`Активная подписка ${expectedWebhook} не найдена`);
}
console.log(`   OK: ${expectedWebhook}`);

console.log('3/4 webhook secret rejection');
const denied = await fetch(expectedWebhook, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Max-Bot-Api-Secret': 'wrong-secret' },
  body: JSON.stringify({ update_type: 'bot_started', timestamp: Date.now(), payload: 'release-check-denied' }),
});
if (denied.status !== 404) throw new Error(`Ожидали 404 для неправильного secret, получили ${denied.status}`);
console.log('   OK: 404');

console.log('4/4 webhook acceptance');
const accepted = await fetch(expectedWebhook, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Max-Bot-Api-Secret': webhookSecret },
  body: JSON.stringify({
    update_type: 'bot_started',
    timestamp: Date.now(),
    user: { user_id: 999999999, name: 'synthetic release check' },
    payload: 'release-check-accepted',
  }),
});
if (accepted.status !== 200) throw new Error(`Ожидали 200 для корректного secret, получили ${accepted.status}`);
console.log('   OK: 200');

console.log('\n✅ Live MAX webhook check passed');
