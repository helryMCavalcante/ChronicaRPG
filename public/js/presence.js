import { apiRequest } from './api.js';
import { requireAuth } from './auth.js';
import { on } from './socket.js';

const userList = document.getElementById('user-list');
let roomId;
let heartbeatTimer;

function renderPresence(list) {
  userList.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Ninguém online';
    userList.append(empty);
    return;
  }
  list.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'user-card';
    row.innerHTML = `<strong>${item.user_id}</strong><span class="muted">${new Date(item.last_seen).toLocaleTimeString()}</span>`;
    userList.append(row);
  });
}

async function fetchPresence() {
  const { presence } = await apiRequest(`/presence?room_id=${roomId}`);
  renderPresence(presence || []);
}

async function heartbeat() {
  await apiRequest('/presence/heartbeat', {
    method: 'POST',
    body: { room_id: roomId }
  });
}

async function startHeartbeat() {
  await heartbeat();
  heartbeatTimer = setInterval(heartbeat, 20_000);
}

export async function initPresence(id) {
  roomId = id;
  await requireAuth();
  await fetchPresence();
  await startHeartbeat();
  on('presence:update', (payload) => {
    if (payload.roomId !== roomId) return;
    fetchPresence();
  });
}

window.addEventListener('beforeunload', () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
});
