// Oda sohbeti
import { $, h } from './dom.js';

export class Chat {
  constructor(game) {
    this.game = game;
    this.log = $('#chat-log');
    $('#chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#chat-input');
      const text = input.value.trim();
      if (text) game.net.chat(text);
      input.value = '';
      input.blur();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'INPUT' && !$('#chat').classList.contains('hidden')) {
        e.preventDefault();
        $('#chat-input').focus();
      }
    });
  }

  show() {
    $('#chat').classList.remove('hidden');
  }

  reset(messages = []) {
    this.log.innerHTML = '';
    for (const m of messages) this.add(m);
  }

  add(m) {
    const time = new Date(m.t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const line = m.system
      ? h('div', { class: 'sys' }, `${time} · ${m.text}`)
      : h('div', {}, h('span', { class: 'name', style: { color: m.color } }, `${m.name}: `), m.text);
    this.log.append(line);
    while (this.log.children.length > 60) this.log.firstChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }
}
