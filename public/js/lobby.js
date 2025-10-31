import { apiRequest } from './api.js';
import { requireAuth } from './auth.js';
import { toast } from './ui.js';

const roomsContainer = document.getElementById('rooms');
const createForm = document.getElementById('create-room');

async function loadRooms() {
  try {
    const { rooms } = await apiRequest('/rooms');
    renderRooms(rooms || []);
  } catch (error) {
    toast(error.message);
  }
}

function renderRooms(list) {
  roomsContainer.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Nenhuma sala disponível. Crie a sua!';
    roomsContainer.append(empty);
    return;
  }
  list.forEach((room) => roomsContainer.append(renderRoomCard(room)));
}

function renderRoomCard(room) {
  const card = document.createElement('article');
  card.className = 'card';
  const header = document.createElement('div');
  header.className = 'nav-actions';
  const title = document.createElement('h3');
  title.textContent = room.name;
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = `${room.member_count || 0}`;
  header.append(title, badge);

  const footer = document.createElement('div');
  footer.className = 'nav-actions';
  const button = document.createElement('button');
  button.className = 'primary';
  button.type = 'button';
  button.textContent = 'Entrar';
  button.addEventListener('click', () => joinRoom(room));
  footer.append(button);
  if (room.is_private) {
    const lock = document.createElement('span');
    lock.className = 'badge';
    lock.textContent = 'Privada';
    footer.append(lock);
  }

  card.append(header, footer);
  return card;
}

async function joinRoom(room) {
  try {
    const response = await apiRequest(`/rooms/${room.id}/join`, { method: 'POST' });
    sessionStorage.setItem('chronica:room', JSON.stringify(response.room));
    window.location.href = `room.html?room=${room.id}`;
  } catch (error) {
    toast(error.message);
  }
}

createForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(createForm);
  const payload = {
    name: formData.get('name'),
    isPrivate: formData.get('isPrivate') === 'yes'
  };
  try {
    const { room } = await apiRequest('/rooms', { method: 'POST', body: payload });
    toast('Sala criada!');
    sessionStorage.setItem('chronica:room', JSON.stringify(room));
    window.location.href = `room.html?room=${room.id}`;
  } catch (error) {
    toast(error.message);
  }
});

requireAuth().then(loadRooms);
