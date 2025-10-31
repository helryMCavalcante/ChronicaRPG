import { getAccessToken } from './supabaseClient.js';

const config = window.__CHRONICA_CONFIG__ || {};
const BASE_URL = config.SERVER_BASE_URL?.replace(/\/$/, '') || '';

let socket;

async function connectSocket() {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Sessão inválida');
  }
  if (!window.io) {
    throw new Error('Socket.IO não carregado');
  }
  socket = window.io(BASE_URL, {
    transports: ['websocket'],
    auth: { token },
    autoConnect: true
  });
  return socket;
}

export async function getSocket() {
  if (socket?.connected) {
    return socket;
  }
  if (socket && !socket.connected) {
    socket.auth = { token: await getAccessToken() };
    socket.connect();
    return socket;
  }
  return connectSocket();
}

export async function emit(event, payload, callback) {
  const instance = await getSocket();
  instance.emit(event, payload, callback);
}

export async function on(event, handler) {
  const instance = await getSocket();
  instance.on(event, handler);
}

export function off(event, handler) {
  if (!socket) return;
  socket.off(event, handler);
}

export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
}
