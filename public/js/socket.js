import { getProfile, requireProfile } from './auth.js';

let socket;

export function getSocket() {
  if (socket) return socket;
  requireProfile();
  if (!window.io) {
    throw new Error('Socket.IO client não carregado');
  }
  socket = window.io({ transports: ['websocket'], autoConnect: false });
  socket.connect();
  const profile = getProfile();
  if (profile) {
    socket.emit('identity:set', profile);
  }
  return socket;
}

export function once(event, handler) {
  getSocket().once(event, handler);
}

export function on(event, handler) {
  getSocket().on(event, handler);
}

export function emit(event, payload, callback) {
  getSocket().emit(event, payload, callback);
}

export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = undefined;
  }
}
