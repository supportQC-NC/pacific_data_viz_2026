// ÉTAPE A — immersion escale 04. Analyse directe des deux GeoJSON.
// Aucune valeur n'est reprise de l'interface : tout est recalculé ici.
import fs from 'fs';

const tracks = JSON.parse(fs.readFileSync('public/data/cyclones/Historique_des_trajectoires.geojson', 'utf8'));
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const STAGE_ORDER = [
  'depression tropicale faible',
  'depression tropicale moderee',
  'depression tropicale forte',
  'cyclone tropical',
  'cyclone tropical intense',
  'cyclone tropical tres intense',
];
const SEVERE_FROM = 3; // « cyclone tropical » et au-dessus

const rows = tracks.features.map((f) => {
  const p = f.properties;
  const season = String(p.saison || '');
  const y = Number(season.slice(0, 4));
  const rank = STAGE_ORDER.indexOf(norm(p.type_max));
  return {
    nom: p.nom, saison: season, y,
    stage: norm(p.type_max), rank,
    vmax: Number(p.vmax_traj),
    pmin: Number(p.pmin_traj) > 0 ? Number(p.pmin_traj) : null,
    moisDeb: Number(p.mois_deb),
    dateDeb: p.date_deb, dateFin: p.date_fin,
  };
});

const seasons = [...new Set(rows.map((r) => r.y))].sort((a, b) => a - b);
console.log('=== PÉRIMÈTRE ===');
console.log(`systèmes : ${rows.length}`);
console.log(`saisons  : ${seasons.length}  (${seasons[0]}/${seasons[0] + 1} → ${seasons.at(-1)}/${seasons.at(-1) + 1})`);
console.log(`saisons sans aucun système : ${(() => { let c = 0; for (let y = seasons[0]; y <= seasons.at(-1); y++) if (!seasons.includes(y)) c++; return c; })()}`);

// ---------- 1. FRÉQUENCE ----------
const bySeason = new Map();
for (let y = seasons[0]; y <= seasons.at(-1); y++) bySeason.set(y, []);
for (const r of rows) bySeason.get(r.y).push(r);
const counts = [...bySeason.entries()].map(([y, a]) => ({ y, n: a.length, sev: a.filter((r) => r.rank >= SEVERE_FROM).length }));

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const slope = (xs, ys) => {
  const mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return num / den;
};
const ns = counts.map((c) => c.n);
console.log('\n=== 1. FRÉQUENCE (nombre de systèmes par saison) ===');
console.log(`min ${Math.min(...ns)} · max ${Math.max(...ns)} · moyenne ${mean(ns).toFixed(1)}`);
console.log(`pente OLS : ${(slope(counts.map((c) => c.y), ns) * 10).toFixed(2)} système(s) par décennie`);
const firstHalf = counts.slice(0, Math.floor(counts.length / 2));
const lastHalf = counts.slice(Math.floor(counts.length / 2));
console.log(`1re moitié (${firstHalf[0].y}–${firstHalf.at(-1).y}) : ${mean(firstHalf.map((c) => c.n)).toFixed(2)} /saison`);
console.log(`2e moitié (${lastHalf[0].y}–${lastHalf.at(-1).y}) : ${mean(lastHalf.map((c) => c.n)).toFixed(2)} /saison`);

// ---------- 2. INTENSITÉ, plusieurs mesures indépendantes ----------
console.log('\n=== 2. INTENSITÉ — quatre mesures indépendantes, par décennie ===');
console.log('déc.  | sais | syst | sévères | part%  | vmax méd | vmax max | ≥90kt');
const decades = {};
for (const r of rows) {
  const d = Math.floor(r.y / 10) * 10;
  (decades[d] = decades[d] || []).push(r);
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
for (const d of Object.keys(decades).sort()) {
  const a = decades[d];
  const ss = new Set(a.map((r) => r.y)).size;
  const sev = a.filter((r) => r.rank >= SEVERE_FROM).length;
  const v = a.map((r) => r.vmax).filter(Number.isFinite);
  const i90 = a.filter((r) => r.vmax >= 90).length;
  console.log(
    `${d}s | ${String(ss).padStart(4)} | ${String(a.length).padStart(4)} | ${String(sev).padStart(7)} | ` +
    `${((sev / a.length) * 100).toFixed(1).padStart(5)} | ${median(v).toFixed(1).padStart(8)} | ${Math.max(...v).toFixed(0).padStart(8)} | ${String(i90).padStart(5)}`
  );
}

// décennies PLEINES seulement
const full = Object.keys(decades).filter((d) => new Set(decades[d].map((r) => r.y)).size === 10).sort();
console.log(`\ndécennies pleines (10 saisons) : ${full.map((d) => d + 's').join(', ')}`);
const share = (d) => { const a = decades[d]; return (a.filter((r) => r.rank >= SEVERE_FROM).length / a.length) * 100; };
console.log(`part sévère, ${full[0]}s → ${full.at(-1)}s : ${share(full[0]).toFixed(1)} % → ${share(full.at(-1)).toFixed(1)} %`);

// ---------- 3. MOYENNE GLISSANTE 5 SAISONS ----------
console.log('\n=== 3. PART SÉVÈRE, moyenne glissante 5 saisons (ce que trace la vue) ===');
const roll = [];
for (let i = 0; i + 5 <= counts.length; i++) {
  const w = counts.slice(i, i + 5);
  const n = w.reduce((a, c) => a + c.n, 0);
  const s = w.reduce((a, c) => a + c.sev, 0);
  roll.push({ y: w[2].y, pct: n ? (s / n) * 100 : null, n });
}
console.log(`fenêtres : ${roll.length} · min ${Math.min(...roll.map((r) => r.pct)).toFixed(1)} % · max ${Math.max(...roll.map((r) => r.pct)).toFixed(1)} %`);
console.log('premières : ' + roll.slice(0, 3).map((r) => `${r.y}:${r.pct.toFixed(0)}%`).join('  '));
console.log('dernières : ' + roll.slice(-3).map((r) => `${r.y}:${r.pct.toFixed(0)}%`).join('  '));

// ---------- 4. SAISONNALITÉ ----------
console.log('\n=== 4. SAISONNALITÉ (mois de genèse) ===');
const MOIS = ['', 'jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
const byMonth = {};
for (const r of rows) byMonth[r.moisDeb] = (byMonth[r.moisDeb] || 0) + 1;
const tot = rows.length;
const core = [12, 1, 2, 3, 4];
const coreN = core.reduce((a, m) => a + (byMonth[m] || 0), 0);
console.log(Object.keys(byMonth).sort((a, b) => a - b).map((m) => `${MOIS[m]} ${byMonth[m]}`).join(' · '));
console.log(`déc→avr : ${coreN}/${tot} = ${((coreN / tot) * 100).toFixed(1)} %`);

// la fenêtre s'est-elle déplacée ?
const half = (a) => { const b = {}; for (const r of a) b[r.moisDeb] = (b[r.moisDeb] || 0) + 1; return b; };
const h1 = half(rows.filter((r) => r.y < 2001)), h2 = half(rows.filter((r) => r.y >= 2001));
const c1 = core.reduce((a, m) => a + (h1[m] || 0), 0), n1 = rows.filter((r) => r.y < 2001).length;
const c2 = core.reduce((a, m) => a + (h2[m] || 0), 0), n2 = rows.filter((r) => r.y >= 2001).length;
console.log(`avant 2001 : ${((c1 / n1) * 100).toFixed(1)} % dans déc→avr  |  depuis 2001 : ${((c2 / n2) * 100).toFixed(1)} %`);

// ---------- 5. VENT / PRESSION ----------
console.log('\n=== 5. VENT ET PRESSION ===');
const pair = rows.filter((r) => Number.isFinite(r.vmax) && r.pmin != null);
console.log(`couples complets : ${pair.length}/${rows.length}  (${rows.length - pair.length} sans pression)`);
const xs = pair.map((r) => r.pmin), ys = pair.map((r) => r.vmax);
const mx = mean(xs), my = mean(ys);
let sxy = 0, sxx = 0, syy = 0;
for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
console.log(`corrélation vent↔pression : r = ${(sxy / Math.sqrt(sxx * syy)).toFixed(3)}`);
console.log(`pression : ${Math.min(...xs)} – ${Math.max(...xs)} hPa · vent : ${Math.min(...ys)} – ${Math.max(...ys)} kt`);

// ---------- 6. LES PLUS VIOLENTS ----------
console.log('\n=== 6. LES DIX PLUS VIOLENTS (vent max) ===');
[...rows].filter((r) => Number.isFinite(r.vmax)).sort((a, b) => b.vmax - a.vmax).slice(0, 10)
  .forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${String(r.nom).padEnd(12)} ${r.saison}  ${String(r.vmax).padStart(5)} kt  ${r.pmin ?? '—'} hPa`));

// ---------- 7. STADES ----------
console.log('\n=== 7. RÉPARTITION PAR STADE DE POINTE ===');
for (let i = 0; i < STAGE_ORDER.length; i++) {
  const n = rows.filter((r) => r.rank === i).length;
  console.log(`${String(n).padStart(3)}  ${((n / tot) * 100).toFixed(1).padStart(5)} %  ${STAGE_ORDER[i]}`);
}
console.log(`\nnon classés (stade absent du barème) : ${rows.filter((r) => r.rank < 0).length}`);
