import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REASONS_PATH = join(__dirname, '..', '..', 'data', 'reasons.json');

let cache = null;

function validate(data) {
  if (!data || typeof data !== 'object') throw new Error('reasons.json: не объект');
  if (!Array.isArray(data.reasons) || data.reasons.length === 0) {
    throw new Error('reasons.json: reasons пуст');
  }
  const required = ['id', 'title', 'weight', 'explanation', 'actions', 'documents', 'legalRef'];
  for (const r of data.reasons) {
    for (const field of required) {
      if (r[field] === undefined) {
        throw new Error(`reasons.json: у причины "${r.id}" нет поля "${field}"`);
      }
    }
  }
  return data;
}

export function loadReasons() {
  if (cache) return cache;
  const raw = readFileSync(REASONS_PATH, 'utf8');
  cache = validate(JSON.parse(raw));
  return cache;
}

export function getReasons() {
  return loadReasons().reasons;
}

export function findReasonById(id) {
  return getReasons().find((r) => r.id === id) ?? null;
}

export function getMeta() {
  const { version, updatedAt, sources } = loadReasons();
  return { version, updatedAt, sources };
}

export function _resetCache() {
  cache = null;
}