// ÉTAPE A — escale 01. Émissions de GES par habitant.
// Source : indicateur Banque mondiale EN.GHG.ALL.PC.CE.AR5, celui-là même que
// l'app lit via le Pacific Data Hub. PDH étant en panne (HTTP 500), on le lit
// ici via World Bank Data360, qui sert le MÊME indicateur.
// ⚠️ PDH publie à UNE décimale ; Data360 en donne davantage. Tout chiffre
// destiné à un texte est donc arrondi à la précision réellement affichée.
const ISO = ['FJI', 'PNG', 'SLB', 'VUT', 'NCL', 'PYF', 'WSM', 'TON', 'TUV', 'COK',
  'NIU', 'WLF', 'TKL', 'ASM', 'PCN', 'FSM', 'GUM', 'MNP', 'MHL', 'NRU', 'PLW', 'KIR'];
const NAME = {
  FJI: 'Fidji', PNG: 'Papouasie-N.-Guinée', SLB: 'Salomon', VUT: 'Vanuatu', NCL: 'Nouvelle-Calédonie',
  PYF: 'Polynésie fr.', WSM: 'Samoa', TON: 'Tonga', TUV: 'Tuvalu', FSM: 'Micronésie (EF)',
  GUM: 'Guam', MNP: 'Mariannes du N.', MHL: 'Marshall', NRU: 'Nauru', PLW: 'Palau', KIR: 'Kiribati',
  ASM: 'Samoa amér.',
};

const r1 = (v) => Math.round(v * 10) / 10;   // précision PDH
const med = (a) => { const s = [...a].sort((x, y) => x - y); const i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };

const rows = [];
for (let skip = 0; skip < 14000; skip += 1000) {
  const u = `https://data360api.worldbank.org/data360/data?DATABASE_ID=WB_WDI&INDICATOR=WB_WDI_EN_GHG_ALL_PC_CE_AR5&skip=${skip}&top=1000`;
  const j = await (await fetch(u)).json();
  const v = j.value || [];
  for (const x of v) if (ISO.includes(x.REF_AREA)) rows.push({ a: x.REF_AREA, y: +x.TIME_PERIOD, v: +x.OBS_VALUE });
  if (v.length < 1000) break;
}

const byArea = {};
for (const r of rows) (byArea[r.a] = byArea[r.a] || []).push(r);
for (const a of Object.keys(byArea)) byArea[a].sort((x, y) => x.y - y.y);

const years = [...new Set(rows.map((r) => r.y))].sort();
const LAST = years[years.length - 1], FIRST = years[0];
console.log(`=== PÉRIMÈTRE ===`);
console.log(`${Object.keys(byArea).length} territoires · ${FIRST}–${LAST} · ${rows.length} observations`);

// --- 1. L'ÉTENDUE, à la précision affichée ---
const at = Object.entries(byArea)
  .map(([a, s]) => ({ a, v: s.filter((p) => p.y === LAST)[0]?.v }))
  .filter((x) => Number.isFinite(x.v)).sort((x, y) => y.v - x.v);
console.log(`\n=== 1. ${LAST} — classement (arrondi PDH, 1 décimale) ===`);
at.forEach((x) => console.log(`  ${String(r1(x.v)).padStart(5)}  ${NAME[x.a] || x.a}`));
const vals = at.map((x) => x.v);
console.log(`médiane ${r1(med(vals))} · min ${r1(Math.min(...vals))} · max ${r1(Math.max(...vals))}`);
console.log(`rapport max/médiane : ×${Math.round(Math.max(...vals) / med(vals))}`);
const floor = at.filter((x) => r1(x.v) === 0.1);
console.log(`territoires au plancher publié (0,1) : ${floor.length} — ${floor.map((x) => NAME[x.a] || x.a).join(', ')}`);
console.log(`  → indiscernables à l'écran ; leur ordre relatif ne veut rien dire`);

// --- 2. LA STABILITÉ, le vrai sujet de l'escale ---
console.log(`\n=== 2. STABILITÉ SUR UN DEMI-SIÈCLE ===`);
const changes = [];
for (const [a, s] of Object.entries(byArea)) {
  if (s.length < 5) continue;
  const f = s[0], l = s[s.length - 1];
  changes.push({ a, f: f.v, fy: f.y, l: l.v, ly: l.y, pct: ((l.v - f.v) / f.v) * 100 });
}
changes.sort((x, y) => y.pct - x.pct);
changes.forEach((c) => console.log(
  `  ${(NAME[c.a] || c.a).padEnd(22)} ${String(r1(c.f)).padStart(5)} (${c.fy}) → ${String(r1(c.l)).padStart(5)} (${c.ly})   ${c.pct >= 0 ? '+' : ''}${Math.round(c.pct)} %`));
const down = changes.filter((c) => c.pct < 0).length;
console.log(`en baisse : ${down}/${changes.length} · en hausse : ${changes.length - down}/${changes.length}`);

// --- 3. LE RANG CHANGE-T-IL ? (ce que la matrice montre) ---
console.log(`\n=== 3. LES TERRITOIRES CHANGENT-ILS DE CAMP ? ===`);
const rankAt = (y) => {
  const l = Object.entries(byArea).map(([a, s]) => ({ a, v: s.find((p) => p.y === y)?.v }))
    .filter((x) => Number.isFinite(x.v)).sort((x, y2) => y2.v - x.v);
  const m = {}; l.forEach((x, i) => { m[x.a] = i + 1; }); return m;
};
const y1 = 1990, y2 = LAST;
const r90 = rankAt(y1), rNow = rankAt(y2);
const common = Object.keys(r90).filter((a) => rNow[a]);
const moves = common.map((a) => ({ a, d: Math.abs(r90[a] - rNow[a]), from: r90[a], to: rNow[a] })).sort((x, y3) => y3.d - x.d);
console.log(`rang ${y1} → ${y2}, sur ${common.length} territoires présents aux deux dates :`);
moves.slice(0, 5).forEach((m) => console.log(`  ${(NAME[m.a] || m.a).padEnd(22)} ${m.from} → ${m.to}  (${m.d})`));
console.log(`déplacement médian : ${med(moves.map((m) => m.d))} place(s)`);
const topHalf = (m) => m <= Math.ceil(common.length / 2);
const switched = common.filter((a) => topHalf(r90[a]) !== topHalf(rNow[a]));
console.log(`territoires ayant changé de MOITIÉ de classement : ${switched.length}/${common.length}` +
  (switched.length ? ` — ${switched.map((a) => NAME[a] || a).join(', ')}` : ''));

// --- 4. LA NERVOSITÉ (le point de l'escale sur le dénominateur) ---
console.log(`\n=== 4. NERVOSITÉ DE LA SÉRIE (écart-type / moyenne) ===`);
const cv = [];
for (const [a, s] of Object.entries(byArea)) {
  const v = s.map((p) => p.v);
  if (v.length < 10) continue;
  const m = v.reduce((x, y4) => x + y4, 0) / v.length;
  const sd = Math.sqrt(v.reduce((x, y5) => x + (y5 - m) ** 2, 0) / v.length);
  cv.push({ a, cv: (sd / m) * 100, m });
}
cv.sort((x, y6) => y6.cv - x.cv);
cv.forEach((c) => console.log(`  ${(NAME[c.a] || c.a).padEnd(22)} ${Math.round(c.cv).toString().padStart(3)} %   (niveau moyen ${r1(c.m)})`));
