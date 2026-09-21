const BASE = import.meta.env.VITE_API_BASE || '';

async function request(path, { method = 'GET', body, initData } = {}) {
  const headers = {
    Accept: 'application/json',
  };

  if (body != null) {
    headers['Content-Type'] = 'application/json';
  }

  if (initData) {
    headers['X-Max-Init-Data'] = initData;
  }

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();

  let data;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    const message =
      typeof data === 'string'
        ? data
        : data?.reason || data?.error || `HTTP ${response.status}`;

    throw new Error(`API ${path}: ${message}`);
  }

  return data;
}

export const api = {
  getMeta: () => request('/api/meta'),
  getScenarios: () => request('/api/scenarios'),
  getReason: (id, initData) =>
    request(`/api/reason/${encodeURIComponent(id)}`, { initData }),
  getChecklist: (id, initData) =>
    request(`/api/checklist/${encodeURIComponent(id)}`, { initData }),
};
