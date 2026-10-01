// Denge simülasyonu: basit bir bot oyunu oynar, ilerleme hızını raporlar.
// Kullanım: npm run balance  [-- --hours 6 --rebirths 2]
import { cityLevelIndex, CITY_LEVELS } from '../shared/data/centers.js';
import { computeStats, stepPlayer, rebirthRequirement } from '../shared/economy.js';
import { envAt } from '../shared/env.js';
import * as A from '../shared/actions.js';
import { botTurn, AVG_ENV } from '../shared/bot.js';
import { formatMoney, formatPower, formatPop, formatDuration } from '../shared/format.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const HOURS = opt('hours', 6);
const MAX_REBIRTHS = opt('rebirths', 2);
const VERBOSE = args.includes('--verbose');

const p = A.newPlayerState({ id: 'bot', name: 'Bot', color: '#fff' });
const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);
let reachedLevel = 0;
let rebirths = 0;
const marks = [];
const log = (t, msg) => {
  const s = computeStats(p, AVG_ENV);
  marks.push(
    `${formatDuration(t).padEnd(12)} ${msg.padEnd(28)} nüfus ${formatPop(p.pop).padEnd(8)} ` +
      `arz ${formatPower(s.supply).padEnd(10)} gelir ${formatMoney(s.net).padEnd(9)}/sn ` +
      `jen ${String(p.generators.length).padEnd(4)} arazi ${p.land}`,
  );
};

for (let t = 0; t < HOURS * 3600; t++) {
  stepPlayer(p, envAt(t0 + t * 1000), 1);
  botTurn(p);
  const lvl = cityLevelIndex(p.pop);
  if (lvl > reachedLevel) {
    reachedLevel = lvl;
    log(t, `→ ${CITY_LEVELS[lvl].name}`);
  }
  if (VERBOSE && t % 600 === 0) log(t, '(ara)');
  if (A.canRebirth(p) && rebirths < MAX_REBIRTHS) {
    log(t, `★ YENİDEN DOĞUŞ #${rebirths + 1}`);
    A.rebirth(p);
    rebirths++;
    reachedLevel = 0;
  }
}
log(HOURS * 3600, 'SON');

console.log(marks.join('\n'));
console.log(`\nSonraki yeniden doğuş: ${formatPop(rebirthRequirement(p.rebirths))} nüfus`);
const owned = {};
for (const g of p.generators) owned[g.type] = (owned[g.type] || 0) + 1;
console.log('Sahip olunan:', Object.entries(owned).map(([k, v]) => `${k}×${v}`).join(', '));
console.log('Merkezler:', JSON.stringify(p.centers));
