import { getReasons } from './reasons.js';

const YES_VALUES = new Set(['да', 'yes', 'true', '1', 'y']);

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function isPositiveAnswer(value) {
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value !== 'string') {
    return false;
  }

  return YES_VALUES.has(normalizeText(value));
}

function keywordSpecificity(keyword) {
  const normalized = normalizeText(keyword);

  return {
    chars: normalized.length,
    words: normalized ? normalized.split(' ').length : 0,
  };
}

function matchesKeyword(normalizedText, keyword) {
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  // Very short keywords such as "ИП" produce too many false positives.
  if (!normalizedKeyword.includes(' ') && normalizedKeyword.length < 4) {
    return false;
  }

  if (normalizedKeyword.includes(' ')) {
    return normalizedText.includes(normalizedKeyword);
  }

  const tokens = normalizedText.split(/[^a-zа-я0-9]+/iu).filter(Boolean);
  const keywordTokens = normalizedKeyword.split(/[^a-zа-я0-9]+/iu).filter(Boolean);

  return keywordTokens.length === 1 && tokens.includes(keywordTokens[0]);
}

function findBestKeywordMatch(text, keywords = []) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return null;
  }

  const matches = keywords
    .filter((keyword) => matchesKeyword(normalizedText, keyword))
    .map((keyword) => ({
      keyword,
      ...keywordSpecificity(keyword),
    }))
    .sort((a, b) => b.words - a.words || b.chars - a.chars);

  return matches[0] ?? null;
}

function buildResults(answers, reasons) {
  const refusalText = answers?.refusalText ?? '';

  return reasons.map((reason) => {
    let score = 0;
    const matchedSignals = [];

    for (const [signalKey, signalWeight] of Object.entries(reason.signals ?? {})) {
      const weight = Number(signalWeight);

      if (!Number.isFinite(weight) || weight <= 0) {
        continue;
      }

      if (signalKey === 'refusalTextMatch') {
        const match = findBestKeywordMatch(refusalText, reason.keywords);

        if (match) {
          score += weight;
          matchedSignals.push({
            key: signalKey,
            weight,
            keyword: match.keyword,
          });
        }

        continue;
      }

      if (isPositiveAnswer(answers?.[signalKey])) {
        score += weight;
        matchedSignals.push({
          key: signalKey,
          weight,
        });
      }
    }

    return {
      reason,
      score,
      matchedSignals,
    };
  });
}

function sortResults(results) {
  return [...results].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (b.matchedSignals.length !== a.matchedSignals.length) {
      return b.matchedSignals.length - a.matchedSignals.length;
    }

    if (Number(b.reason.weight) !== Number(a.reason.weight)) {
      return Number(b.reason.weight) - Number(a.reason.weight);
    }

    return a.reason.id.localeCompare(b.reason.id);
  });
}

function fallbackResult(reasons) {
  const fallback = reasons.find((reason) => reason.id === 'other');

  return fallback
    ? [{ reason: fallback, score: 0, matchedSignals: [] }]
    : [];
}

export function matchReasons(answers = {}) {
  const reasons = getReasons();
  const results = sortResults(buildResults(answers, reasons));
  const matched = results.filter((item) => item.score > 0);

  return matched.length > 0 ? matched : fallbackResult(reasons);
}

export function formatReasonCard(result) {
  const reason = result?.reason ?? result;
  const matchedSignals = result?.matchedSignals ?? [];

  const lines = [
    '⚠️ *Возможная причина*',
    `*${reason.title}*`,
    '',
    reason.explanation,
  ];

  if (matchedSignals.length > 0) {
    lines.push('', '*Почему этот вариант выбран:*');

    for (const signal of matchedSignals) {
      const detail = signal.keyword ? ` — «${signal.keyword}»` : '';
      lines.push(`• ${signal.key}${detail}`);
    }
  }

  lines.push(
    '',
    '*Что делать:*',
    ...(reason.actions ?? []).map((action) => `• ${action}`),
    '',
    `*Куда обращаться:* ${reason.whereToApply ?? 'СФР, «Госуслуги»'}`,
    `*Основание:* ${reason.legalRef ?? 'Уточните в СФР'}`,
    '',
    '_Это информационная подсказка, а не официальное решение ведомства._',
  );

  if (Array.isArray(reason.documents) && reason.documents.length > 0) {
    lines.push('', '*Документы:*');

    for (const document of reason.documents) {
      lines.push(`• ${document}`);
    }
  }

  return lines.join('\n');
}

export { isPositiveAnswer, normalizeText, findBestKeywordMatch };
