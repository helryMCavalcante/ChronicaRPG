const MESSAGE_MAX_LENGTH = 1500;
const ROLL_REGEX = /^\d{1,2}d\d{1,3}([+\-]\d{1,3})?$/i;

export function sanitizeMessage(input = '') {
  return String(input)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, MESSAGE_MAX_LENGTH);
}

export function validateMessage(input) {
  const text = sanitizeMessage(input);
  if (!text.trim()) {
    throw new Error('Mensagem vazia');
  }
  return text;
}

export function validateRollFormula(formula) {
  if (!ROLL_REGEX.test(formula)) {
    throw new Error('Fórmula inválida');
  }
  return formula;
}
