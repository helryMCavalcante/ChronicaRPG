import crypto from 'crypto';
import { validateRollFormula } from './validation.js';

export function rollDice(formulaRaw) {
  const formula = validateRollFormula(formulaRaw.toLowerCase());
  const match = formula.match(/^(\d{1,2})d(\d{1,3})([+\-]\d{1,3})?$/);
  if (!match) {
    throw new Error('Fórmula inválida');
  }
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3]) : 0;
  const rolls = [];
  for (let i = 0; i < count; i += 1) {
    const roll = crypto.randomInt(1, sides + 1);
    rolls.push(roll);
  }
  const sum = rolls.reduce((acc, value) => acc + value, 0);
  const total = sum + modifier;
  return {
    formula,
    rolls,
    modifier,
    sum,
    total
  };
}
