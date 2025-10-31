const toastContainer = document.querySelector('.toast-container');

export function setTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
}

export function toast(message, timeout = 3500) {
  if (!toastContainer) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.role = 'status';
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('hide');
    el.remove();
  }, timeout);
}

export function confirmDialog({ title = 'Confirmar', message = '', confirmText = 'OK', cancelText = 'Cancelar' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const p = document.createElement('p');
    p.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'nav-actions';
    const cancel = document.createElement('button');
    cancel.textContent = cancelText;
    cancel.className = 'ghost';
    const confirm = document.createElement('button');
    confirm.textContent = confirmText;
    confirm.className = 'primary';
    actions.append(cancel, confirm);
    modal.append(heading, p, actions);
    overlay.append(modal);
    document.body.append(overlay);

    const cleanup = (value) => {
      overlay.remove();
      resolve(value);
    };

    cancel.addEventListener('click', () => cleanup(false));
    confirm.addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cleanup(false);
    });
  });
}

export function modal(contentBuilder) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  const content = contentBuilder({ close });
  modal.append(content);
  overlay.append(modal);
  document.body.append(overlay);

  function close() {
    overlay.remove();
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  return { close };
}

export function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    toast('Copiado para a área de transferência');
  } else {
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.append(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
    toast('Copiado');
  }
}

export function formatTime(time) {
  const date = new Date(time);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function markdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/https?:\/\/\S+/g, (match) => `<a href="${match}" target="_blank" rel="noopener">${match}</a>`);
}
