import './style.css';
import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

// Hata ayıklama için konsoldan erişim
window.solaria = game;

// ?vitrin -> tüm santral modellerini gösteren galeri adası (sunucusuz)
const params = new URLSearchParams(location.search);
if (params.has('vitrin')) {
  const phase = params.get('saat');
  game.showcase({ phase: phase != null ? Number(phase) : null });
}
