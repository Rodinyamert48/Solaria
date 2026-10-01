// Bağlantı seçimi:
//  ?sunucu=https://...   -> o adresteki online sunucu
//  VITE_SERVER_URL        -> derleme sırasında verilen online sunucu
//  VITE_OFFLINE=1 / ?yerel -> tarayıcı içi tek oyunculu mod (GitHub Pages)
//  aksi halde             -> sayfayı sunan sunucu (npm start / npm run dev)
import { Net } from './net.js';
import { LocalServer } from './local/localServer.js';

export function createConnection() {
  const params = new URLSearchParams(location.search);
  const url = params.get('sunucu') || import.meta.env.VITE_SERVER_URL || null;
  if (url) return new Net(url);
  if (import.meta.env.VITE_OFFLINE === '1' || params.has('yerel')) return new LocalServer();
  return new Net();
}
