import { setTheme, toast } from './ui.js';

const PROFILE_KEY = 'chronica:profile';

export function getProfile() {
  const stored = localStorage.getItem(PROFILE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to parse profile', error);
    return null;
  }
}

export function saveProfile(profile) {
  const data = {
    nickname: profile.nickname.trim().slice(0, 30),
    avatar: profile.avatar?.trim().slice(0, 200) || '',
    theme: profile.theme === 'dark' ? 'dark' : 'light'
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
  setTheme(data.theme);
  return data;
}

export function requireProfile() {
  const profile = getProfile();
  if (!profile) {
    window.location.href = 'index.html';
    return null;
  }
  setTheme(profile.theme || 'light');
  return profile;
}

function initIndex() {
  const form = document.getElementById('profile-form');
  if (!form) return;
  const existing = getProfile();
  if (existing) {
    form.nickname.value = existing.nickname;
    form.avatar.value = existing.avatar;
    form.theme.value = existing.theme;
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = saveProfile({
      nickname: form.nickname.value,
      avatar: form.avatar.value,
      theme: form.theme.value
    });
    toast('Perfil salvo.');
    setTimeout(() => {
      window.location.href = 'lobby.html';
    }, 250);
  });
}

function initThemeButton() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  const profile = requireProfile();
  if (!profile) return;
  btn.addEventListener('click', () => {
    const next = profile.theme === 'dark' ? 'light' : 'dark';
    const updated = saveProfile({ ...profile, theme: next });
    Object.assign(profile, updated);
  });
}

function initLogout() {
  const btn = document.getElementById('btn-logout');
  if (!btn) return;
  btn.addEventListener('click', () => {
    localStorage.removeItem(PROFILE_KEY);
    window.location.href = 'index.html';
  });
}

initIndex();
initThemeButton();
initLogout();
