import path from 'node:path';
import { config } from '../config.js';
import { createJsonStore } from './jsonStore.js';

const store = createJsonStore(
  path.resolve(config.dataDir, 'sessions.json'),
  {
    fallback: {},
    label: 'storage',
  }
);

const sessions = store.getAll();

function nowIso() {
  return new Date().toISOString();
}

function isExpired(state) {
  if (!state?.updatedAt || config.sessionTtlSeconds <= 0) {
    return false;
  }

  const updatedAt = Date.parse(state.updatedAt);

  if (!Number.isFinite(updatedAt)) {
    return true;
  }

  return Date.now() - updatedAt > config.sessionTtlSeconds * 1000;
}

function pruneExpired() {
  let changed = false;

  for (const [key, state] of Object.entries(sessions)) {
    if (isExpired(state)) {
      delete sessions[key];
      changed = true;
    }
  }

  if (changed) {
    store.save();
  }
}

function normalizeState(state = {}) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('[storage] state must be an object');
  }

  return {
    ...state,
    updatedAt: nowIso(),
  };
}

function applyPatch(current, patch) {
  const next = {
    ...(current ?? {}),
  };

  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }

  return normalizeState(next);
}

export const storage = {
  get(userId) {
    const key = String(userId);
    const state = sessions[key] ?? null;

    if (state && isExpired(state)) {
      delete sessions[key];
      store.save();
      return null;
    }

    return state;
  },

  set(userId, state) {
    const key = String(userId);
    const timestamp = nowIso();

    sessions[key] = normalizeState({
      ...state,
      createdAt: state?.createdAt ?? timestamp,
    });

    store.save();
    return sessions[key];
  },

  update(userId, patch) {
    const key = String(userId);
    const next = applyPatch(sessions[key], patch);

    sessions[key] = next;
    store.save();

    return next;
  },

  clearAnswers(userId) {
    return this.update(userId, { answers: undefined });
  },

  pruneExpired() {
    pruneExpired();
  },

  reset(userId) {
    delete sessions[String(userId)];
    store.save();
  },

  _reset() {
    for (const key of Object.keys(sessions)) {
      delete sessions[key];
    }

    store.save();
  },

  _filePath: store.filePath,
};

pruneExpired();
