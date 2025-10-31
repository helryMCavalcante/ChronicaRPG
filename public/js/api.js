import { getAccessToken } from './supabaseClient.js';

const config = window.__CHRONICA_CONFIG__ || {};
const BASE_URL = config.SERVER_BASE_URL?.replace(/\/$/, '') || '';

export async function apiRequest(path, options = {}) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Sessão expirada');
  }
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    signal: options.signal
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.error || 'Falha na requisição';
    throw new Error(message);
  }
  return response.json();
}
