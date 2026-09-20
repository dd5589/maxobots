import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
}

function writeJsonAtomic(filePath, value) {
  const directory = path.dirname(filePath);
  ensureDirectory(directory);

  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`
  );

  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const handle = fs.openSync(tempPath, 'wx', 0o600);

  try {
    fs.writeFileSync(handle, payload, 'utf8');
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }

  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

function readJson(filePath, fallback, label) {
  ensureDirectory(path.dirname(filePath));

  if (!fs.existsSync(filePath)) {
    writeJsonAtomic(filePath, fallback);
    return structuredClone(fallback);
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw || JSON.stringify(fallback));

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('ожидался JSON-объект');
    }

    fs.chmodSync(filePath, 0o600);
    return parsed;
  } catch (error) {
    throw new Error(
      `[${label}] Не удалось прочитать ${filePath}: ${error.message}`
    );
  }
}

export function createJsonStore(filePath, {
  fallback = {},
  label = 'json-store',
} = {}) {
  const resolvedPath = path.resolve(filePath);
  let data = readJson(resolvedPath, fallback, label);

  const persist = () => {
    writeJsonAtomic(resolvedPath, data);
  };

  return {
    getAll() {
      return data;
    },

    replace(nextData) {
      if (!nextData || typeof nextData !== 'object' || Array.isArray(nextData)) {
        throw new TypeError(`[${label}] root data must be an object`);
      }

      data = nextData;
      persist();
      return data;
    },

    save() {
      persist();
      return data;
    },

    filePath: resolvedPath,
  };
}
