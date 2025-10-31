import { supabase, getCurrentSession } from './supabaseClient.js';
import { toast } from './ui.js';

const authListeners = new Set();

function updateHeader(user) {
  const authState = document.getElementById('auth-state');
  const loginBtn = document.getElementById('btn-login');
  const logoutBtn = document.getElementById('btn-logout');
  if (authState) {
    authState.textContent = user ? `Logado como ${user.email}` : 'Desconectado';
  }
  if (loginBtn) {
    loginBtn.style.display = user ? 'none' : 'inline-flex';
  }
  if (logoutBtn) {
    logoutBtn.style.display = user ? 'inline-flex' : 'none';
  }
}

async function refreshAuthState() {
  const session = await getCurrentSession();
  const user = session?.user || null;
  updateHeader(user);
  authListeners.forEach((listener) => listener(user));
  return user;
}

export function onAuthChange(callback) {
  authListeners.add(callback);
  refreshAuthState();
  return () => authListeners.delete(callback);
}

export async function requireAuth() {
  const session = await getCurrentSession();
  if (!session?.user) {
    window.location.href = 'index.html';
    return null;
  }
  return session.user;
}

function initLoginForm() {
  const form = document.getElementById('login-form');
  const feedback = document.getElementById('login-feedback');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = new FormData(form).get('email');
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      if (feedback) feedback.textContent = 'Link enviado! Verifique seu e-mail.';
    } catch (error) {
      if (feedback) feedback.textContent = 'Falha ao enviar link.';
      toast(error.message || 'Erro no login');
    }
  });
}

function initButtons() {
  const loginBtn = document.getElementById('btn-login');
  const logoutBtn = document.getElementById('btn-logout');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      toast('Sessão encerrada.');
      updateHeader(null);
      if (window.location.pathname.endsWith('lobby.html') || window.location.pathname.endsWith('room.html')) {
        window.location.href = 'index.html';
      }
    });
  }
}

supabase.auth.onAuthStateChange(() => {
  refreshAuthState();
});

initLoginForm();
initButtons();
refreshAuthState();
