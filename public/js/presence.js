import { on, emit } from './socket.js';
import { toast } from './ui.js';

const userList = document.getElementById('user-list');
const presenceButton = document.getElementById('btn-presence');

function renderPresence(list) {
  if (!userList) return;
  userList.innerHTML = '';
  list.forEach((member) => {
    const row = document.createElement('div');
    row.className = 'user-item';
    row.dataset.socketId = member.socketId;
    const avatar = document.createElement('div');
    avatar.className = 'voice-indicator';
    const name = document.createElement('div');
    name.innerHTML = `<strong>${member.nickname}</strong><div class="role">${member.role}</div>`;
    const actions = document.createElement('div');
    actions.className = 'list-inline';
    actions.textContent = member.status || 'online';
    row.append(avatar, name, actions);
    row.addEventListener('click', () => {
      navigator.clipboard?.writeText(member.socketId);
      toast('ID copiado para comandos de moderação');
    });
    userList.append(row);
  });
}

presenceButton?.addEventListener('click', () => {
  emit('presence:update', { status: 'online' });
  toast('Atualizado');
});

on('presence:update', renderPresence);

export function initPresence() {
  emit('presence:update', { status: 'online' });
}
