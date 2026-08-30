// Inventaire EXHAUSTIF des emplacements de texte des douze escales.
// Compte chaque champ éditorial réellement passé au template, résout sa
// valeur (dictionnaire ou littéral JSX) et mesure la duplication.
import fs from 'fs';
import path from 'path';

const fr = JSON.parse(fs.readFileSync('src/i18n/fr.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('src/i18n/en.json', 'utf8'));
const raw = fs.readFileSync('src/i18n/extraStrings.js', 'utf8');
const E = new Function(raw.replace('export default EXTRA_STRINGS;', '') + '; return EXTRA_STRINGS;')();
const merge = (a, b) => {
  const o = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' ? merge(o[k], v) : v;
  }
  return o;
};
const flat = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o || {})) {
    const K = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, K, out);
    else out[K] = v;
  }
  return out;
};
const FR = flat(merge(fr, E.fr));

const ORDER = [
  ['01', 'Act1Emissions'], ['02', 'Act2Ocean'], ['03', 'Act8Ciel'], ['04', 'Act12Cyclones'],
  ['05', 'Act6Agriculture'], ['06', 'Act7Vivant'], ['07', 'Act3Territory'], ['08', 'Act10Sante'],
  ['09', 'Act4Impact'], ['10', 'Act5Momentum'], ['11', 'Act9Eco'], ['12', 'Act11Synthese'],
];

// Champs éditoriaux, groupés par FAMILLE de la typologie de l'audit.
const FIELDS = {
  narratif: ['thesis', 'text', 'kicker', 'eyebrow'],
  editorial: ['title', 'subtitle', 'takeaway', 'tab', 'name'],
  explicatif: ['finding', 'hint', 'caveat', 'method'],
  fonctionnel: ['y', 'x', 'color', 'note', 'unit', 'label', 'low', 'high', 'present', 'absent'],
};
const FIELD_OF = {};
for (const [fam, ks] of Object.entries(FIELDS)) for (const k of ks) FIELD_OF[k] = fam;

const BT = '`';
const STR = String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|` + BT + String.raw`(?:[^` + BT + String.raw`\\]|\\.)*` + BT + String.raw`)`;
const ARG = String.raw`(?:` + STR + String.raw`|([A-Za-z_$][\w$.]*))`;
const RE = new RegExp(
  String.raw`\b(t|tx|tf)\(\s*` + STR + String.raw`\s*(?:,\s*` + ARG + String.raw`\s*)?(?:,\s*` + ARG + String.raw`\s*)?,?\s*\)`,
  'gs'
);
const clean = (x) => (x ? x.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\'/g, "'").replace(/\s+/g, ' ').trim() : null);

const perEscale = [];
const texts = new Map();   // texte -> Set(escale)
const famCount = {};

for (const [num, dir] of ORDER) {
  const file = path.join('src/pages', dir, `${dir}.jsx`);
  const s = fs.readFileSync(file, 'utf8');
  const lines = s.split('\n');
  const counts = {};
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(s))) {
    const key = clean(m[2]);
    if (!key || !/^[a-zA-Z0-9_.]+$/.test(key) || !key.includes('.')) continue;
    const ln = s.slice(0, m.index).split('\n').length;
    let prop = null;
    for (let i = ln - 1; i >= Math.max(0, ln - 7); i--) {
      const pm = (lines[i] || '').match(/^\s*([a-zA-Z_]+)\s*:/);
      if (pm) { prop = pm[1]; break; }
    }
    const fam = FIELD_OF[prop];
    if (!fam) continue;
    const val = FR[key] ?? clean(m[3]);
    if (!val || typeof val !== 'string') continue;
    counts[fam] = (counts[fam] || 0) + 1;
    famCount[fam] = (famCount[fam] || 0) + 1;
    if (val.length > 24) {
      if (!texts.has(val)) texts.set(val, new Set());
      texts.get(val).add(num);
    }
  }
  perEscale.push({ num, dir, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
}

console.log('EMPLACEMENTS DE TEXTE ÉDITORIAL, PAR ESCALE\n');
console.log('esc |  narr | édito | expli | fonct | TOTAL');
console.log('----+-------+-------+-------+-------+------');
let grand = 0;
for (const e of perEscale) {
  const c = e.counts;
  grand += e.total;
  console.log(
    ` ${e.num} | ${String(c.narratif || 0).padStart(5)} | ${String(c.editorial || 0).padStart(5)} | ` +
    `${String(c.explicatif || 0).padStart(5)} | ${String(c.fonctionnel || 0).padStart(5)} | ${String(e.total).padStart(5)}`
  );
}
console.log('----+-------+-------+-------+-------+------');
console.log(
  `    | ${String(famCount.narratif || 0).padStart(5)} | ${String(famCount.editorial || 0).padStart(5)} | ` +
  `${String(famCount.explicatif || 0).padStart(5)} | ${String(famCount.fonctionnel || 0).padStart(5)} | ${String(grand).padStart(5)}`
);

const dup = [...texts.entries()].filter(([, s]) => s.size > 1).sort((a, b) => b[1].size - a[1].size);
console.log(`\nTEXTES IDENTIQUES SUR PLUSIEURS ESCALES : ${dup.length} chaînes`);
const reuse = dup.reduce((a, [, s]) => a + s.size, 0);
console.log(`soit ${reuse} emplacements remplis par ${dup.length} textes distincts.\n`);
for (const [t, s] of dup.slice(0, 12)) {
  console.log(`  ${s.size} escales [${[...s].sort().join(' ')}]`);
  console.log(`     "${t.slice(0, 96)}${t.length > 96 ? '…' : ''}"`);
}
