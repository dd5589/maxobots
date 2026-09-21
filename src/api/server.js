import http from 'node:http';
import { config } from '../config.js';
import { getMeta, findReasonById } from '../services/reasons.js';
import { getCategories, getScenarios } from '../services/scenarios.js';
import { validateInitData } from './validation.js';

const CORS = {
  'Access-Control-Allow-Origin': config.corsOrigin,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Max-Init-Data',
  Vary: 'Origin',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};

function json(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS,
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function requireAuth(req, res) {
  const initData = req.headers['x-max-init-data'];

  if (
    config.allowDevAuth &&
    process.env.NODE_ENV !== 'production' &&
    initData === 'dev-init-data'
  ) {
    return {
      id: 'dev-user',
      first_name: 'Dev',
    };
  }

  const result = validateInitData(
    initData,
    config.botToken,
    {
      maxAgeSeconds: config.maxInitDataMaxAgeSeconds,
    }
  );

  if (!result.valid) {
    json(res, 401, {
      error: 'invalid_init_data',
      reason: result.error,
    });
    return null;
  }

  return result.user;
}

function sendNotFound(res) {
  return json(res, 404, { error: 'not_found' });
}

function sendMethodNotAllowed(res) {
  return json(res, 405, { error: 'method_not_allowed' }, {
    Allow: 'GET, OPTIONS',
  });
}

function decodeResourceId(rawId) {
  try {
    return decodeURIComponent(rawId);
  } catch {
    return null;
  }
}

function toChecklist(reason) {
  return {
    reasonId: reason.id,
    title: reason.title,
    steps: (reason.actions ?? []).map((text, index) => ({
      id: `s${index + 1}`,
      text,
      done: false,
    })),
    documents: (reason.documents ?? []).map((text, index) => ({
      id: `d${index + 1}`,
      text,
      done: false,
    })),
    whereToApply: reason.whereToApply,
    legalRef: reason.legalRef,
  };
}

export function createApiServer({ authenticate = requireAuth } = {}) {
  return http.createServer((req, res) => {
    const url = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? 'localhost'}`
    );

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      return sendMethodNotAllowed(res);
    }

    if (url.pathname === '/health') {
      return json(res, 200, { status: 'ok' }, {
        'Cache-Control': 'no-store',
      });
    }

    if (url.pathname === '/api/meta') {
      return json(res, 200, {
        ...getMeta(),
        categoriesCount: getCategories().length,
        scenariosCount: getScenarios().length,
      }, {
        'Cache-Control': 'public, max-age=300',
      });
    }

    if (url.pathname === '/api/scenarios') {
      return json(res, 200, {
        categories: getCategories(),
        scenarios: getScenarios().map((scenario) => ({
          id: scenario.id,
          categoryId: scenario.categoryId,
          title: scenario.title,
          description: scenario.description,
          sources: scenario.sources ?? [],
        })),
      }, {
        'Cache-Control': 'public, max-age=300',
      });
    }

    const reasonMatch = url.pathname.match(/^\/api\/reason\/([^/]+)$/);
    const checklistMatch = url.pathname.match(/^\/api\/checklist\/([^/]+)$/);

    if (!reasonMatch && !checklistMatch) {
      return sendNotFound(res);
    }

    const user = authenticate(req, res);

    if (!user) {
      return;
    }

    const rawId = (reasonMatch ?? checklistMatch)[1];
    const id = decodeResourceId(rawId);

    if (!id || id.length > 100) {
      return json(res, 400, { error: 'invalid_id' });
    }

    const reason = findReasonById(id);

    if (!reason) {
      return sendNotFound(res);
    }

    if (reasonMatch) {
      return json(res, 200, reason);
    }

    return json(res, 200, toChecklist(reason));
  });
}

export function startApiServer({
  port = config.port,
  host = '0.0.0.0',
  authenticate = requireAuth,
} = {}) {
  const server = createApiServer({ authenticate });

  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`[api] http://${host}:${actualPort}`);
  });

  return server;
}
