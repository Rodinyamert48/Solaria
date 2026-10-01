// Giriş ekranı
import { $, h } from './dom.js';
import { loadAccount } from '../net.js';

const COLORS = ['#ff6b6b', '#ffb347', '#ffd93d', '#6bcB77', '#4fb3ff', '#7c6cff', '#d36bff', '#ff7ab6', '#3fd0c9', '#f4f1ea'];

export function setupLogin(onSubmit) {
  const acc = loadAccount();
  let color = acc?.color || COLORS[Math.floor(Math.random() * COLORS.length)];
  const swatches = $('#login-colors');
  const draw = () => {
    swatches.innerHTML = '';
    for (const c of COLORS) {
      swatches.append(
        h('button', {
          type: 'button',
          class: `swatch ${c.toLowerCase() === color.toLowerCase() ? 'active' : ''}`,
          style: { background: c },
          title: c,
          onclick: () => {
            color = c;
            draw();
          },
        }),
      );
    }
  };
  draw();
  if (acc?.name) {
    $('#login-name').value = acc.name;
    $('#login-btn').textContent = `Devam et, ${acc.name} ▶`;
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#login-name').value.trim();
    if (name.length < 2) {
      $('#login-error').textContent = 'Takma ad en az 2 karakter olmalı';
      return;
    }
    $('#login-btn').disabled = true;
    $('#login-error').textContent = '';
    const res = await onSubmit({ name, color: color.toLowerCase() });
    $('#login-btn').disabled = false;
    if (!res.ok) $('#login-error').textContent = res.error || 'Giriş başarısız';
  });
}

export function setServerStatus(text) {
  $('#server-status').textContent = text;
}

export function hideLogin() {
  $('#login').classList.add('hidden');
}
