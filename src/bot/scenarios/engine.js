import { findScenarioById } from '../../services/scenarios.js';
import { getQuestionsForParent } from './questionSets.js';

export function getScenario(scenarioId) {
  return findScenarioById(scenarioId);
}

export function getScenarioQuestions(scenarioId) {
  const scenario = findScenarioById(scenarioId);
  if (!scenario) return [];

  if (scenario.questionsRef === 'parent_unified_allowance') {
    return getQuestionsForParent();
  }

  return scenario.questions ?? [];
}

export function getQuestionForScenario(scenarioId, index) {
  return getScenarioQuestions(scenarioId)[index] ?? null;
}

export function getQuestionById(scenarioId, questionId) {
  return getScenarioQuestions(scenarioId).find((question) => question.id === questionId) ?? null;
}

export function totalQuestions(scenarioId) {
  return getScenarioQuestions(scenarioId).length;
}

export function getInitialQuestion(scenarioId) {
  return getScenarioQuestions(scenarioId)[0] ?? null;
}

export function getOption(option, index) {
  if (option && typeof option === 'object') {
    return {
      value: String(option.value ?? option.label ?? index),
      label: String(option.label ?? option.value ?? index),
      next: option.next ?? null,
      resultId: option.resultId ?? null,
    };
  }

  return {
    value: String(option),
    label: String(option),
    next: null,
    resultId: null,
  };
}

export function getOptions(question) {
  return (question?.options ?? []).map((option, index) => getOption(option, index));
}

export function getNextTransition(scenarioId, questionId, answerValue) {
  const question = getQuestionById(scenarioId, questionId);
  if (!question) return null;

  const option = getOptions(question).find((item) => item.value === String(answerValue));

  if (option?.next) {
    return { type: 'question', questionId: option.next, resultId: null };
  }

  if (option?.resultId) {
    return { type: 'result', questionId: null, resultId: option.resultId };
  }

  if (question.nextByValue && Object.prototype.hasOwnProperty.call(question.nextByValue, String(answerValue))) {
    const next = question.nextByValue[String(answerValue)];
    if (typeof next === 'string' && next.startsWith('result:')) {
      return { type: 'result', questionId: null, resultId: next.slice('result:'.length) };
    }
    if (typeof next === 'string') {
      return { type: 'question', questionId: next, resultId: null };
    }
  }

  if (question.next) {
    if (typeof question.next === 'string' && question.next.startsWith('result:')) {
      return { type: 'result', questionId: null, resultId: question.next.slice('result:'.length) };
    }
    return { type: 'question', questionId: question.next, resultId: null };
  }

  return null;
}

export function getScenarioResult(scenarioId, resultId) {
  const scenario = findScenarioById(scenarioId);
  if (!scenario) return null;

  if (resultId && scenario.results?.[resultId]) {
    return scenario.results[resultId];
  }

  return scenario.result ?? null;
}
