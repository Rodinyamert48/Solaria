import { settings } from '../settings.js';

// Küçük DOM yardımcıları
export const $ = (sel) => document.querySelector(sel);

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function toast(text, kind = '', life = 2.6) {
  // Ayarlarda bildirimler kapalıysa yalnızca hata uyarıları gösterilir
  if (settings.get('notifications') === false && kind !== 'bad') return;
  const el = h('div', { class: `toast ${kind}`, style: { '--life': `${life}s` } }, text);
  $('#toasts').append(el);
  setTimeout(() => el.remove(), (life + 0.5) * 1000);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}

export function floater(text, x, y) {
  const el = h('div', { class: 'floater', style: { left: `${x}px`, top: `${y}px` } }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), 1200);
}

// İki aşamalı onay: ilk tık metni değiştirir, ikinci tık onaylar
export function confirmButton(btn, label, onConfirm) {
  let armed = false;
  let timer = null;
  const original = btn.textContent;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!armed) {
      armed = true;
      btn.textContent = label;
      timer = setTimeout(() => {
        armed = false;
        btn.textContent = original;
      }, 3000);
      return;
    }
    clearTimeout(timer);
    armed = false;
    btn.textContent = original;
    onConfirm();
  });
}

export function escapeText(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
