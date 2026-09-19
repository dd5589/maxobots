import { getReasons } from './reasons.js';

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function isPositiveAnswer(value) {
  if (value === true) {
    return true;
  }

  if (typeof value !== 'string') {
    return false;
  }

  return ['да', 'yes', 'true', '1'].includes(normalizeText(value));
}

function keywordSpecificity(keyword) {
  const normalized = normalizeText(keyword);
  return {
    chars: normalized.length,
    words: normalized ? normalized.split(' ').length : 0,
  };
}

function findBestKeywordMatch(text, keywords = []) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return null;
  }

  const matches = keywords
    .filter((keyword) => normalizedText.includes(normalizeText(keyword)))
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

export function matchReasons(answers = {}) {
  const reasons = getReasons();
  const results = sortResults(buildResults(answers, reasons));
  const matched = results.filter((item) => item.score > 0);

  if (matched.length > 0) {
    return matched;
  }

  const fallback = reasons.find((reason) => reason.id === 'other');

  if (!fallback) {
    return [];
  }

  return [
    {
      reason: fallback,
      score: 0,
      matchedSignals: [],
    },
  ];
}

export function formatReasonCard(reason) {
  const lines = [
    `*${reason.title}*`,
    '',
    reason.explanation,
    '',
    '*Что делать:*',
  ];

  for (const action of reason.actions ?? []) {
    lines.push(`• ${action}`);
  }

  lines.push(
    '',
    `*Куда обращаться:* ${reason.whereToApply ?? 'СФР, «Госуслуги»'}`,
    `*Основание:* ${reason.legalRef ?? 'Уточните в СФР'}`
  );

  if (Array.isArray(reason.documents) && reason.documents.length > 0) {
    lines.push('', '*Документы:*');

    for (const document of reason.documents) {
      lines.push(`• ${document}`);
    }
  }

  return lines.join('\\n');
}

export { isPositiveAnswer };
