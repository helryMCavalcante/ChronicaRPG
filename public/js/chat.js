import { apiRequest } from './api.js';
import { requireAuth } from './auth.js';
import { toast, formatTime } from './ui.js';
import { emit, on } from './socket.js';
import { executeRoll, renderRoll, initDice } from './dice.js';
import { initPresence } from './presence.js';

const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

let roomId;

function getAuthor(message) {
  return message.user?.email || message.user_id || 'Anônimo';
}

function renderMessage(message) {
  if (!chatLog) return;
  const article = document.createElement('article');
  article.className = 'message';
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<strong>${getAuthor(message)}</strong>`;
  const time = document.createElement('span');
  time.className = 'muted';
  const created = message.created_at ? new Date(message.created_at).getTime() : Date.now();
  time.textContent = formatTime(created);
  meta.append(time);
  const body = document.createElement('div');
  body.className = 'body';
  body.textContent = message.content;
  article.append(meta, body);
  chatLog.append(article);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function loadMessages() {
  const { messages } = await apiRequest(`/messages?room_id=${roomId}`);
  chatLog.innerHTML = '';
  (messages || []).forEach(renderMessage);
}

async function handleSubmit(event) {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  if (text.startsWith('/roll')) {
    const [, formula = '1d20'] = text.split(' ');
    await executeRoll(formula, roomId);
    chatInput.value = '';
    return;
  }
  try {
    await apiRequest('/messages', {
      method: 'POST',
      body: { room_id: roomId, content: text }
    });
    chatInput.value = '';
  } catch (error) {
    toast(error.message);
  }
}

export async function initChat() {
  const user = await requireAuth();
  if (!user) return;
  const params = new URLSearchParams(window.location.search);
  roomId = params.get('room');
  if (!roomId) {
    toast('Sala inválida.');
    window.location.href = 'lobby.html';
    return;
  }
  const stored = sessionStorage.getItem('chronica:room');
  if (stored) {
    const room = JSON.parse(stored);
    document.getElementById('room-name').textContent = room.name;
  }
  emit('room:subscribe', roomId, (response) => {
    if (!response?.ok) {
      toast(response.error || 'Falha ao assinar a sala');
    }
  });
  on('connect', () => {
    emit('room:subscribe', roomId, () => {});
  });
  await loadMessages();
  initDice(roomId);
  initPresence(roomId);
  chatForm?.addEventListener('submit', handleSubmit);
  on('message:new', (payload) => {
    if (payload.room_id !== roomId) return;
    renderMessage(payload);
  });
  on('roll:new', (payload) => {
    if (payload.room_id !== roomId) return;
    renderRoll(payload);
  });
}

initChat();
