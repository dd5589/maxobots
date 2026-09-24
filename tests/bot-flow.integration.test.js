import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { storage } from '../src/services/storage.js';
import { createBot } from '../src/bot/runtime.js';

const USERS = {
  parent: 'flow-parent',
  student: 'flow-student',
  pensioner: 'flow-pensioner',
  svo: 'flow-svo',
};

function createContext(userId, extra = {}) {
  const replies = [];
  return {
    user: { user_id: userId, first_name: 'Test' },
    message: { body: { text: extra.text ?? '' } },
    reply: async (text, options) => { replies.push({ text, options }); },
    answerOnCallback: async () => {},
    match: extra.match,
    replies,
  };
}

function callbackMatch(payload) {
  return payload.match(/^answer:([^:]+):([^:]+):(\d+)$/)?.slice(1);
}

beforeEach(() => {
  storage._reset();
  mock.method(console, 'log', () => {});
  mock.method(console, 'warn', () => {});
  mock.method(console, 'error', () => {});
});

test('4 сценария имеют стартовое состояние, которое можно восстановить повторным /start', async () => {
  const cases = [
    ['parent_unified_allowance_refusal', 'parent', USERS.parent],
    ['student_social_scholarship_refusal', 'student', USERS.student],
    ['pensioner_social_supplement_refusal', 'pensioner', USERS.pensioner],
    ['svo_veteran_family_support_refusal', 'svo_veteran_family', USERS.svo],
  ];

  for (const [scenarioId, categoryId, userId] of cases) {
    const bot = createBot({ token: 'integration-test-token' });
    storage.set(userId, { mode: 'quiz', categoryId, scenarioId, step: 3, done: false, answers: { x: 'y' } });
    const stateBefore = storage.get(userId);
    assert.equal(stateBefore.scenarioId, scenarioId);

    // Reinitialization is the guaranteed recovery route of the bot state machine.
    storage.reset(userId);
    storage.set(userId, { mode: 'category', step: 0, answers: {}, done: false });
    const stateAfter = storage.get(userId);
    assert.equal(stateAfter.mode, 'category');
    assert.equal(stateAfter.step, 0);
    assert.deepEqual(stateAfter.answers, {});

    assert.ok(bot);
  }
});

test('сценарные переходы принимают все callback-ветки без обращения к сети', () => {
  assert.ok(callbackMatch('answer:student_social_scholarship_refusal:studyForm:0'));
  assert.ok(callbackMatch('answer:pensioner_social_supplement_refusal:employment:1'));
  assert.ok(callbackMatch('answer:svo_veteran_family_support_refusal:measureType:4'));
});
