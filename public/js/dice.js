import { apiRequest } from './api.js';
import { toast, formatTime } from './ui.js';

const rollHistory = document.getElementById('roll-history');
const btnRollD20 = document.getElementById('btn-roll-d20');
const rollForm = document.getElementById('roll-form');
const rollFormula = document.getElementById('roll-formula');

let roomId;

function getAuthor(roll) {
  return roll.user?.email || roll.user_id || 'Jogador';
}

export function renderRoll(roll) {
  if (!rollHistory) return;
  const container = document.createElement('article');
  container.className = 'message roll-result';
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<strong>${getAuthor(roll)}</strong>`;
  const time = document.createElement('span');
  time.className = 'muted';
  const created = roll.created_at ? new Date(roll.created_at).getTime() : Date.now();
  time.textContent = formatTime(created);
  meta.append(time);
  const body = document.createElement('div');
  body.className = 'body';
  const result = roll.result || {};
  const detail = Array.isArray(result.rolls) ? result.rolls.join(', ') : '';
  body.innerHTML = `<p>${roll.formula} → <strong>${result.total ?? '?'}</strong></p>`;
  if (detail) {
    body.innerHTML += `<small>Dados: [${detail}]</small>`;
  }
  container.append(meta, body);
  rollHistory.prepend(container);
}

export async function executeRoll(formula, id) {
  try {
    await apiRequest('/rolls', {
      method: 'POST',
      body: { room_id: id, formula }
    });
  } catch (error) {
    toast(error.message);
  }
}

async function loadRolls() {
  if (!roomId || !rollHistory) return;
  try {
    const { rolls } = await apiRequest(`/rolls?room_id=${roomId}`);
    rollHistory.innerHTML = '';
    (rolls || []).reverse().forEach(renderRoll);
  } catch (error) {
    toast(error.message);
  }
}

function initForm() {
  if (!rollForm) return;
  rollForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formula = rollFormula.value.trim() || '1d20';
    await executeRoll(formula, roomId);
    rollFormula.value = '';
  });
  btnRollD20?.addEventListener('click', async () => {
    await executeRoll('1d20', roomId);
  });
}

export function initDice(id) {
  roomId = id;
  initForm();
  loadRolls();
}
