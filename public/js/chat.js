import { emit, on } from './socket.js';
import { requireProfile } from './auth.js';
import { toast, markdown, formatTime, modal } from './ui.js';
import { rollExpression } from './dice.js';
import { initVoiceShortcuts } from './voice.js';
import { initPresence } from './presence.js';
import { initSheets } from './sheets.js';

const profile = requireProfile();
const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const channelList = document.getElementById('channel-list');
const activeChannelTitle = document.getElementById('active-channel');
const btnAddChannel = document.getElementById('btn-add-channel');
const btnRollD20 = document.getElementById('btn-roll-d20');
const btnRollCustom = document.getElementById('btn-roll-custom');

let currentChannel = 'general';
let roomId;
let role = 'PLAYER';
const channelHistory = new Map();

function initRoom() {
  const stored = sessionStorage.getItem('chronica:room');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('room');
  if (!stored || !id) {
    toast('Sala inválida.');
    window.location.href = 'lobby.html';
    return;
  }
  const payload = JSON.parse(stored);
  document.getElementById('room-name').textContent = payload.name;
  document.getElementById('room-description').textContent = payload.description || '';
  role = payload.role;
  roomId = payload.id;
  if (role === 'PLAYER') {
    btnAddChannel?.setAttribute('disabled', 'disabled');
  }
  renderChannels(payload.channels || []);
  (payload.history || []).forEach(({ channelId, messages }) => {
    messages.forEach((message) => {
      storeMessage({ ...message, channelId });
    });
  });
  renderChannelMessages(currentChannel);
}

function renderChannelMessages(id) {
  chatLog.innerHTML = '';
  const entries = channelHistory.get(id) || [];
  entries.forEach((event) => renderMessage(event, true));
  scrollChat();
}

function renderChannels(channels) {
  channelList.innerHTML = '';
  channels.forEach((channel) => {
    const button = document.createElement('button');
    button.className = 'channel-chip';
    button.dataset.channelId = channel.id;
    button.textContent = channel.name;
    if (!channelHistory.has(channel.id)) {
      channelHistory.set(channel.id, channelHistory.get(channel.id) || []);
    }
    if (channel.id === currentChannel) button.classList.add('active');
    button.addEventListener('click', () => switchChannel(channel.id, channel.name));
    channelList.append(button);
  });
}

function switchChannel(id, name) {
  currentChannel = id;
  activeChannelTitle.textContent = `Chat · ${name}`;
  document.querySelectorAll('.channel-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.channelId === id);
  });
  renderChannelMessages(id);
}

function storeMessage(event) {
  const channelId = event.channelId || 'general';
  const list = channelHistory.get(channelId) || [];
  if (!list.some((item) => item.id === event.id)) {
    list.push(event);
  }
  channelHistory.set(channelId, list);
}

function renderMessage(event, skipStore = false) {
  if (!skipStore) storeMessage(event);
  const container = document.createElement('article');
  container.className = 'message';
  if (event.type === 'roll') container.classList.add('roll-result');
  container.dataset.messageId = event.id;
  container.dataset.channelId = event.channelId || 'general';

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<strong>${event.author?.nickname || 'Sistema'}</strong>`;
  if (event.author?.role) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = event.author.role;
    meta.append(badge);
  }
  const time = document.createElement('span');
  time.className = 'muted';
  time.textContent = formatTime(event.timestamp);
  meta.append(time);
  container.append(meta);

  const body = document.createElement('div');
  body.className = 'body';
  if (event.type === 'roll') {
    body.innerHTML = `<p><strong>${event.author.nickname}</strong> rolou <code>${event.expression}</code> = <strong>${event.outcome.total}</strong></p>`;
    const detail = document.createElement('small');
    detail.innerHTML = event.outcome.detail
      .map((d) => `${d.term}: [${d.kept ? d.kept.join(', ') : d.rolls?.join(', ') || d.sum}] → ${d.sum}`)
      .join('<br>');
    body.append(detail);
    if (event.outcome.label) {
      const label = document.createElement('p');
      label.innerHTML = `<em>${event.outcome.label}</em>`;
      body.append(label);
    }
  } else {
    body.innerHTML = markdown(event.message || '');
  }
  container.append(body);

  chatLog.append(container);
}

function scrollChat() {
  chatLog.scrollTo({ top: chatLog.scrollHeight, behavior: 'smooth' });
}

function handleCommand(input) {
  const trimmed = input.trim();
  if (trimmed.startsWith('/roll')) {
    const expression = trimmed.replace('/roll', '').trim() || '1d20';
    const outcome = rollExpression(expression);
    emit('roll:execute', { expression }, (response) => {
      if (!response?.ok) {
        toast(response?.message || 'Erro na rolagem');
        return;
      }
    });
    return;
  }
  if (trimmed.startsWith('/w')) {
    const [, target, ...rest] = trimmed.split(' ');
    emit('chat:message', {
      channelId: currentChannel,
      whisperTo: target?.replace('@', ''),
      message: rest.join(' ')
    }, (response) => {
      if (!response?.ok) toast(response?.message || 'Erro no sussurro');
    });
    return;
  }
  if (trimmed.startsWith('/gmonly')) {
    const [, state] = trimmed.split(' ');
    if (role === 'PLAYER') {
      toast('Apenas GM/Co-GM.');
      return;
    }
    currentChannel = state === 'on' ? 'gm' : 'general';
    toast(`Canal ${currentChannel}`);
    return;
  }
  if (trimmed.startsWith('/mute') || trimmed.startsWith('/ban')) {
    if (role === 'PLAYER') {
      toast('Apenas GM/Co-GM.');
      return;
    }
    const [, target] = trimmed.split(' ');
    const action = trimmed.startsWith('/mute') ? 'mute' : 'ban';
    emit('moderation:action', { action, targetId: target }, (response) => {
      if (!response?.ok) toast(response?.message || 'Erro na ação');
    });
    return;
  }
  if (trimmed.startsWith('/help')) {
    modal(() => {
      const box = document.createElement('div');
      box.innerHTML = `
        <h3>Comandos</h3>
        <ul>
          <li><code>/roll 2d6+3 #Ataque</code></li>
          <li><code>/w @nome mensagem</code></li>
          <li><code>/gmonly on|off</code></li>
          <li><code>/mute @id</code>, <code>/ban @id</code></li>
        </ul>`;
      return box;
    });
    return;
  }
}

chatForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = chatInput.value;
  if (!value.trim()) return;
  if (value.startsWith('/')) {
    handleCommand(value);
  } else {
    emit('chat:message', { channelId: currentChannel, message: value }, (response) => {
      if (!response?.ok) toast(response?.message || 'Erro ao enviar mensagem');
    });
  }
  chatInput.value = '';
});

on('chat:message', (event) => {
  storeMessage(event);
  if (event.channelId && event.channelId !== currentChannel && event.type !== 'whisper') return;
  renderMessage(event, true);
  scrollChat();
});

on('roll:result', (event) => {
  event.channelId = 'general';
  storeMessage(event);
  if (currentChannel === 'general') {
    renderMessage(event, true);
    scrollChat();
  }
});
on('chat:channels', renderChannels);
on('chat:delete', ({ messageId }) => {
  const el = chatLog.querySelector(`[data-message-id="${messageId}"]`);
  if (el) {
    el.classList.add('muted');
    el.querySelector('.body').textContent = '[mensagem removida]';
  }
});

btnAddChannel?.addEventListener('click', () => {
  modal(({ close }) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <h3>Novo canal</h3>
      <label>Nome<input id="new-channel-name" maxlength="30"></label>
      <button class="primary" type="button">Criar</button>`;
    wrapper.querySelector('button').addEventListener('click', () => {
      const input = wrapper.querySelector('#new-channel-name');
      if (!input.value.trim()) return;
      emit('chat:channel', { name: input.value }, (response) => {
        if (!response?.ok) {
          toast(response?.message || 'Erro ao criar canal');
          return;
        }
        renderChannels(response.channels);
        close();
      });
    });
    return wrapper;
  });
});

btnRollD20?.addEventListener('click', () => {
  handleCommand('/roll 1d20');
});

btnRollCustom?.addEventListener('click', () => {
  modal(({ close }) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <h3>Rolagem personalizada</h3>
      <input id="custom-roll" placeholder="4d6kh3+2 #Furtividade">
      <button class="primary" type="button">Rolar</button>`;
    wrapper.querySelector('button').addEventListener('click', () => {
      const value = wrapper.querySelector('#custom-roll').value;
      handleCommand(`/roll ${value}`);
      close();
    });
    return wrapper;
  });
});

window.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement !== chatInput) {
    event.preventDefault();
    chatInput.focus();
  }
  if (event.key.toLowerCase() === 'm') {
    const btn = document.getElementById('btn-mute');
    btn?.click();
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    modal(() => {
      const box = document.createElement('div');
      box.innerHTML = '<h3>Busca rápida</h3><p>Selecione um canal na lateral.</p>';
      return box;
    });
  }
});

function initRoomPresence() {
  initPresence();
  initVoiceShortcuts();
  initSheets();
}

initRoom();
initRoomPresence();
