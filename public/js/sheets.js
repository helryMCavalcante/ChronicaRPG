import { emit, on, getSocket } from './socket.js';
import { copyToClipboard, toast } from './ui.js';

const SHEET_KEY = 'chronica:sheet';
const form = document.getElementById('sheet-form');
const exportButton = document.getElementById('btn-export-sheet');

let saveTimeout;

function loadSheet() {
  const stored = localStorage.getItem(SHEET_KEY);
  if (!stored) return {};
  try {
    const data = JSON.parse(stored);
    Object.entries(data).forEach(([key, value]) => {
      const field = form?.elements.namedItem(key);
      if (field) field.value = value;
    });
    return data;
  } catch (error) {
    console.error('Invalid sheet data', error);
    return {};
  }
}

function saveSheet() {
  if (!form) return;
  const data = Object.fromEntries(new FormData(form).entries());
  localStorage.setItem(SHEET_KEY, JSON.stringify(data));
  emit('sheet:update', { sheet: data });
}

export function initSheets() {
  if (!form) return;
  const initial = loadSheet();
  emit('sheet:update', { sheet: initial });

  form.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveSheet, 400);
  });
}

on('sheet:update', ({ socketId, sheet }) => {
  if (!form) return;
  if (socketId === getSocket().id) return;
  Object.entries(sheet).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field && !field.matches(':focus')) {
      field.value = value;
    }
  });
});

exportButton?.addEventListener('click', () => {
  const data = Object.fromEntries(new FormData(form).entries());
  copyToClipboard(JSON.stringify(data, null, 2));
  toast('Ficha copiada');
});
