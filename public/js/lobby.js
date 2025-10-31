import { emit, on } from './socket.js';
import { requireProfile } from './auth.js';
import { toast } from './ui.js';

const roomsContainer = document.getElementById('rooms');
const createForm = document.getElementById('create-room');
const profile = requireProfile();

function renderRoomCard(room) {
  const card = document.createElement('article');
  card.className = 'card';
  const header = document.createElement('div');
  header.className = 'nav-actions';
  const title = document.createElement('h3');
  title.textContent = room.name;
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = `${room.population}/10`;
  header.append(title, badge);

  const description = document.createElement('p');
  description.textContent = room.description || 'Sem descrição';

  const footer = document.createElement('div');
  footer.className = 'nav-actions';
  const button = document.createElement('button');
  button.className = 'primary';
  button.type = 'button';
  button.textContent = 'Entrar';
  button.addEventListener('click', () => joinRoom(room));
  footer.append(button);

  if (room.isPrivate) {
    const lock = document.createElement('span');
    lock.className = 'badge';
    lock.textContent = 'Privada';
    footer.append(lock);
  }

  card.append(header, description, footer);
  return card;
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

function joinRoom(room) {
  const password = room.isPrivate ? prompt('Senha da sala') : undefined;
  emit('room:join', { roomId: room.id, password }, (response) => {
    if (!response?.ok) {
      toast(response?.message || 'Falha ao entrar');
      return;
    }
    sessionStorage.setItem('chronica:room', JSON.stringify(response.room));
    window.location.href = `room.html?room=${room.id}`;
  });
}

createForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(createForm);
  const payload = {
    name: formData.get('name'),
    description: formData.get('description'),
    isPrivate: formData.get('isPrivate') === 'yes',
    password: formData.get('password')
  };
  emit('room:create', payload, (response) => {
    if (!response?.ok) {
      toast(response?.message || 'Erro ao criar sala');
      return;
    }
    toast('Sala criada!');
    joinRoom({ id: response.roomId, isPrivate: payload.isPrivate });
  });
});

on('rooms:list', renderRooms);
emit('rooms:fetch');

if (profile) {
  document.title = `ChronicaRPG · ${profile.nickname}`;
}
