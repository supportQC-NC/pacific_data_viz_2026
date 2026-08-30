// ÉTAPE A (suite) — le test décisif de l'escale 04.
// Si la PART de systèmes sévères monte, deux causes possibles :
//   (a) il y a plus de systèmes sévères  → intensification réelle
//   (b) il y a moins de systèmes faibles → effet de dénominateur
// Ces deux histoires sont radicalement différentes. On tranche.
import fs from 'fs';

const g = JSON.parse(fs.readFileSync('public/data/cyclones/Historique_des_trajectoires.geojson', 'utf8'));
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const STAGES = ['depression tropicale faible', 'depression tropicale moderee', 'depression tropicale forte',
  'cyclone tropical', 'cyclone tropical intense', 'cyclone tropical tres intense'];

const rows = g.features.map((f) => {
  const p = f.properties;
  return {
    nom: p.nom, y: Number(String(p.saison).slice(0, 4)),
    rank: STAGES.indexOf(norm(p.type_max)),
    vmax: Number(p.vmax_traj),
    mois: Number(String(p.mois_deb).split('-')[0]),
  };
});
const seasons = [];
for (let y = 1977; y <= 2023; y++) seasons.push(y);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const slope = (xs, ys) => {
  const mx = mean(xs), my = mean(ys);
  let n = 0, d = 0;
  for (let i = 0; i < xs.length; i++) { n += (xs[i] - mx) * (ys[i] - my); d += (xs[i] - mx) ** 2; }
  return n / d;
};

// --- LE TEST DÉCISIF ---
console.log('=== LE TEST : sévères et faibles comptés SÉPARÉMENT ===\n');
const per = seasons.map((y) => {
  const a = rows.filter((r) => r.y === y);
  return { y, sev: a.filter((r) => r.rank >= 3).length, weak: a.filter((r) => r.rank >= 0 && r.rank < 3).length };
});
const P1 = per.filter((p) => p.y < 2000), P2 = per.filter((p) => p.y >= 2000);
console.log('période      | sévères/saison | faibles/saison | part sévère');
for (const [lab, P] of [['1977–1999', P1], ['2000–2023', P2]]) {
  const s = mean(P.map((p) => p.sev)), w = mean(P.map((p) => p.weak));
  console.log(`${lab}    |     ${s.toFixed(2)}       |     ${w.toFixed(2)}       |   ${((s / (s + w)) * 100).toFixed(1)} %`);
}
console.log(`\npente OLS, sévères par saison : ${(slope(seasons, per.map((p) => p.sev)) * 10).toFixed(2)} / décennie`);
console.log(`pente OLS, faibles par saison : ${(slope(seasons, per.map((p) => p.weak)) * 10).toFixed(2)} / décennie`);

// --- décennies pleines, en comptes absolus ---
console.log('\n=== COMPTES ABSOLUS PAR DÉCENNIE PLEINE (10 saisons) ===');
console.log('déc.  | sévères | faibles | total');
for (const d of [1980, 1990, 2000, 2010]) {
  const a = rows.filter((r) => Math.floor(r.y / 10) * 10 === d);
  console.log(`${d}s |  ${String(a.filter((r) => r.rank >= 3).length).padStart(5)}  |  ${String(a.filter((r) => r.rank < 3).length).padStart(5)}  | ${String(a.length).padStart(5)}`);
}

// --- moyenne glissante complète ---
console.log('\n=== PART SÉVÈRE — moyenne glissante 5 saisons, série complète ===');
const roll = [];
for (let i = 0; i + 5 <= per.length; i++) {
  const w = per.slice(i, i + 5);
  const s = w.reduce((a, c) => a + c.sev, 0), t = w.reduce((a, c) => a + c.sev + c.weak, 0);
  roll.push({ y: w[2].y, pct: t ? (s / t) * 100 : null });
}
let line = '';
for (const r of roll) line += `${r.y}:${r.pct.toFixed(0)}%  `;
console.log(line.replace(/((?:\S+\s+){8})/g, '$1\n'));
console.log(`pente OLS sur la glissante : ${(slope(roll.map((r) => r.y), roll.map((r) => r.pct)) * 10).toFixed(2)} points / décennie`);

// --- saisonnalité, corrigée ---
console.log('\n=== SAISONNALITÉ (mois de genèse) ===');
const M = ['', 'jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
const bm = {};
for (const r of rows) bm[r.mois] = (bm[r.mois] || 0) + 1;
console.log(Object.keys(bm).map(Number).sort((a, b) => a - b).map((m) => `${M[m]} ${bm[m]}`).join(' · '));
const core = [12, 1, 2, 3];
const inCore = (a) => a.filter((r) => core.includes(r.mois)).length;
console.log(`déc→mars : ${inCore(rows)}/${rows.length} = ${((inCore(rows) / rows.length) * 100).toFixed(1)} %`);
const A = rows.filter((r) => r.y < 2000), B = rows.filter((r) => r.y >= 2000);
console.log(`  avant 2000 : ${((inCore(A) / A.length) * 100).toFixed(1)} %   depuis 2000 : ${((inCore(B) / B.length) * 100).toFixed(1)} %`);
const mm = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const toIdx = (m) => (m >= 7 ? m - 7 : m + 5); // juillet = 0
console.log(`mois médian de genèse (saison australe) — avant 2000 : ${M[[...A].map((r) => r.mois).sort((a, b) => toIdx(a) - toIdx(b))[A.length >> 1]]}` +
  `   depuis 2000 : ${M[[...B].map((r) => r.mois).sort((a, b) => toIdx(a) - toIdx(b))[B.length >> 1]]}`);

// --- vent médian par période, test complémentaire ---
console.log('\n=== VENT MAXIMAL — indépendant de toute classification ===');
const med = (a) => { const s = [...a].sort((x, y) => x - y); const i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
for (const [lab, a] of [['1977–1999', A], ['2000–2023', B]]) {
  const v = a.map((r) => r.vmax).filter(Number.isFinite);
  console.log(`${lab} : médiane ${med(v).toFixed(1)} kt · moyenne ${mean(v).toFixed(1)} kt · n=${v.length}`);
}
console.log(`pente OLS du vent médian par saison : ${(slope(seasons, seasons.map((y) => { const v = rows.filter((r) => r.y === y).map((r) => r.vmax).filter(Number.isFinite); return v.length ? med(v) : null; }).map((x, i) => x ?? 0)) * 10).toFixed(2)} kt / décennie`);
