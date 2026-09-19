import { config, assertBotToken } from '../config.js';

const API_BASE = 'https://platform-api2.max.ru';

async function request(path, { method = 'GET', body } = {}) {
  assertBotToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: config.botToken,
        'Content-Type': 'application/json',
      },
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await response.text();

    let data = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }

    if (!response.ok) {
      throw new Error(
        `MAX API ${response.status}: ${
          typeof data === 'string' ? data : JSON.stringify(data)
        }`
      );
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export const maxApi = {
  async sendMessage({ userId, text, format = 'markdown', attachments }) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const body = {
      text,
      format,
    };

    if (Array.isArray(attachments) && attachments.length > 0) {
      body.attachments = attachments;
    }

    return request(`/messages?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body,
    });
  },

  async getMe() {
    return request('/me');
  },
};
