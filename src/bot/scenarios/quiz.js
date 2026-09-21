import { getQuestionsForParent } from './questionSets.js';

export const QUESTIONS = getQuestionsForParent();

export function getQuestion(index) {
  return QUESTIONS[index] ?? null;
}

export function totalQuestions() {
  return QUESTIONS.length;
}
