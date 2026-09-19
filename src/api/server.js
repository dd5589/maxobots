import http from 'node:http';
import { config } from '../config.js';
import { getMeta, findReasonById } from '../services/reasons.js';
import { validateInitData } from './validation.js';

const CORS = {
  'Access-Control-Allow-Origin': config.corsOrigin,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Max-Init-Data',
};

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS,
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
      user_id: 'dev-user',
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

  if (!result.user) {
    json(res, 401, {
      error: 'invalid_init_data',
      reason: 'user_missing',
    });
    return null;
  }

  return result.user;
}

function sendNotFound(res) {
  return json(res, 404, { error: 'not_found' });
}

export function startApiServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { status: 'ok' });
    }

    if (req.method === 'GET' && url.pathname === '/api/meta') {
      return json(res, 200, getMeta());
    }

    const reasonMatch = url.pathname.match(/^\/api\/reason\/([^/]+)$/);
    const checklistMatch = url.pathname.match(/^\/api\/checklist\/([^/]+)$/);

    if (reasonMatch || checklistMatch) {
      const user = requireAuth(req, res);

      if (!user) {
        return;
      }

      const id = decodeURIComponent(
        (reasonMatch ?? checklistMatch)[1]
      );

      const reason = findReasonById(id);

      if (!reason) {
        return sendNotFound(res);
      }

      if (reasonMatch) {
        return json(res, 200, reason);
      }

      return json(res, 200, {
        reasonId: reason.id,
        title: reason.title,
        steps: reason.actions.map((text, index) => ({
          id: `s${index + 1}`,
          text,
          done: false,
        })),
        documents: reason.documents.map((text, index) => ({
          id: `d${index + 1}`,
          text,
          done: false,
        })),
        whereToApply: reason.whereToApply,
        legalRef: reason.legalRef,
      });
    }

    return json(res, 404, { error: 'not_found' });
  });

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`[api] http://0.0.0.0:${config.port}`);
  });

  return server;
}
