import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const filePath = path.resolve(config.dataDir, 'users.json');

function ensureFile() {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readAll() {
  ensureFile();

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw || '{}');

    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('[storage] Не удалось прочитать users.json:', error.message);
    return {};
  }
}

function writeAll(data) {
  ensureFile();

  const tempPath = `${filePath}.tmp`;

  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

const users = readAll();

export const storage = {
  get(userId) {
    return users[String(userId)] ?? null;
  },

  set(userId, state) {
    users[String(userId)] = state;
    writeAll(users);
  },

  update(userId, patch) {
    const key = String(userId);
    const current = users[key] ?? {};
    const next = { ...current, ...patch };

    users[key] = next;
    writeAll(users);

    return next;
  },

  reset(userId) {
    delete users[String(userId)];
    writeAll(users);
  },

  _reset() {
    for (const key of Object.keys(users)) {
      delete users[key];
    }

    writeAll(users);
  },
};
