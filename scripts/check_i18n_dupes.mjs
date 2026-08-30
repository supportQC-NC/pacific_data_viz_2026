import fs from 'fs';
const src = fs.readFileSync('src/i18n/extraStrings.js', 'utf8');
const seen = [];
const dupes = [];
let i = 0, line = 1;
const n = src.length;
while (i < n) {
  const c = src[i], c2 = src[i + 1];
  if (c === '\n') { line++; i++; continue; }
  if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') i++; continue; }
  if (c === '/' && c2 === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
  if (c === '"' || c === "'" || c === '`') {
    const q = c; i++;
    while (i < n) { if (src[i] === '\\') { i += 2; continue; } if (src[i] === q) { i++; break; } if (src[i] === '\n') line++; i++; }
    continue;
  }
  if (c === '{') { seen.push(new Map()); i++; continue; }
  if (c === '}') { seen.pop(); i++; continue; }
  if (/[A-Za-z_$]/.test(c)) {
    let j = i;
    while (j < n && /[\w$]/.test(src[j])) j++;
    const word = src.slice(i, j);
    let k = j;
    while (k < n && /\s/.test(src[k])) k++;
    if (src[k] === ':') {
      const cur = seen[seen.length - 1];
      if (cur) {
        if (cur.has(word)) dupes.push({ key: word, first: cur.get(word), second: line });
        else cur.set(word, line);
      }
      i = k + 1;
      continue;
    }
    i = j;
    continue;
  }
  i++;
}
if (!dupes.length) console.log('extraStrings.js — no duplicate keys.');
else {
  console.log('DUPLICATE KEYS (the later one silently wins):');
  for (const d of dupes) console.log(`  "${d.key}"  line ${d.first} -> REDECLARED line ${d.second}`);
  process.exitCode = 1;
}
