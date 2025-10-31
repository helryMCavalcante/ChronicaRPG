import { toast } from './ui.js';

const dicePattern = /([+-]?)(\d*)d(\d+)(!?)(?:(kh|kl)(\d+))?/i;

export function rollExpression(input) {
  const expression = input.trim();
  if (!expression) {
    return {
      rolls: [],
      total: 0,
      detail: [],
      label: ''
    };
  }

  let label = '';
  let body = expression;
  const labelIndex = expression.indexOf('#');
  if (labelIndex !== -1) {
    label = expression.slice(labelIndex + 1).trim();
    body = expression.slice(0, labelIndex).trim();
  }

  const tokens = body.split(/\s+/).filter(Boolean);
  let adv = false;
  let dis = false;
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i].toLowerCase();
    if (token === 'adv') {
      adv = true;
      tokens.splice(i, 1);
    } else if (token === 'dis') {
      dis = true;
      tokens.splice(i, 1);
    }
  }
  const normalized = tokens.join('');
  const detail = [];
  let total = 0;

  const segments = normalized.match(/([+-]?[^+-]+)/g) || [];
  segments.forEach((segment) => {
    const match = segment.match(dicePattern);
    if (match) {
      const sign = match[1] === '-' ? -1 : 1;
      let count = match[2] ? Number(match[2]) : 1;
      const sides = Number(match[3]);
      const explode = match[4] === '!';
      let keepType = match[5];
      let keepCount = match[6] ? Number(match[6]) : undefined;
      if (adv || dis) {
        if (count === 1 && sides === 20) {
          count = 2;
          keepType = adv ? 'kh' : 'kl';
          keepCount = 1;
        }
      }
      if (!keepCount) keepCount = count;
      const rolls = [];
      for (let i = 0; i < count; i += 1) {
        let next = true;
        while (next) {
          const roll = Math.ceil(Math.random() * sides);
          rolls.push(roll);
          next = explode && roll === sides && rolls.length < 100;
        }
      }
      const sorted = [...rolls].sort((a, b) => (keepType === 'kl' ? a - b : b - a));
      const kept = sorted.slice(0, keepCount);
      const sum = kept.reduce((acc, value) => acc + value, 0) * sign;
      detail.push({ term: segment, rolls, kept, sum });
      total += sum;
    } else {
      const value = Number(segment);
      if (Number.isNaN(value)) {
        toast(`Termo inválido: ${segment}`);
        return;
      }
      total += value;
      detail.push({ term: segment, sum: value });
    }
  });

  const result = {
    rolls: detail.flatMap((item) => item.rolls || []),
    total,
    detail,
    label,
    adv,
    dis
  };
  return result;
}
