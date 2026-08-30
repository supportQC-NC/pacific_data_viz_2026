// src/components/KeyFigures/fromBundle.js
// ============================================================
// Fabrique les trois chiffres-clés d'une escale à partir de ce que la page
// calcule DÉJÀ. Aucune requête supplémentaire, aucune valeur écrite en dur :
// si la série change, les chiffres changent.
//
// Pourquoi un helper plutôt que trois `useMemo` recopiés onze fois : les
// escales portent des mesures très différentes (des tonnes, des degrés, un
// indice de 0 à 1, des comptages) mais la MÊME question de lecture — « où en
// est la région, qui est à l'extrême, sur quelle période ». Recopier le calcul
// aurait garanti onze arrondis divergents.
//
// Le bundle attendu est celui que la plupart des pages construisent déjà sous
// le nom `M` : { rank: [{name, value}], med, years, unit, A, B }. Les pages qui
// ne l'ont pas passent les champs à la main.
// ============================================================

import { fmt, median as medianOf } from "../charts/echartsBase";

// Décimales choisies sur l'ORDRE DE GRANDEUR, pas sur un réglage par escale :
// « 0,9 » et « 87 » doivent tous deux se lire d'un coup d'œil, et « 0 » ou
// « 86,7 » seraient l'un muet, l'autre bavard.
function dec(v) {
  const a = Math.abs(v);
  if (a >= 100) return 0;
  // Deux décimales UNIQUEMENT sous 0,1, où la première ne dirait rien : à
  // 0,5 mm, « 0,50 » traîne un zéro qui suggère une précision inexistante.
  return a >= 0.1 ? 1 : 2;
}

export default function figuresFromBundle(bundle, labels = {}) {
  if (!bundle) return [];
  const rows = (bundle.rank || bundle.rows || []).filter(
    (r) => r && Number.isFinite(Number(r.value)),
  );
  const years = bundle.years || [];
  const unit = bundle.unit || "";
  const out = [];

  // 1. LA MÉDIANE. Une moyenne serait tirée par les extrêmes — et sur presque
  //    toutes ces séries, l'extrême est un très petit territoire.
  const med = Number.isFinite(bundle.med)
    ? bundle.med
    : medianOf(rows.map((r) => Number(r.value)));
  if (Number.isFinite(med)) {
    out.push({
      value: fmt(med, dec(med)),
      unit,
      label: labels.median,
      meta: labels.medianMeta,
    });
  }

  // 2. L'EXTRÊME. `worst: "low"` quand c'est la valeur BASSE qui alerte
  //    (indice Liste Rouge, accès à l'eau) : prendre le maximum y désignerait
  //    le meilleur élève en le présentant comme le cas notable.
  if (rows.length) {
    const pick =
      bundle.worst === "low"
        ? (m, r) => (!m || Number(r.value) < Number(m.value) ? r : m)
        : (m, r) => (!m || Number(r.value) > Number(m.value) ? r : m);
    const edge = rows.reduce(pick, null);
    const v = Number(edge.value);
    out.push({
      value: fmt(v, dec(v)),
      unit,
      label: labels.edge,
      meta: edge.name,
    });
  }

  // 3. LA PÉRIODE. C'est la portée de tout ce qu'on vient d'affirmer, et
  //    aucune vue ne la donne sans qu'on aille la chercher dans un axe.
  const a = bundle.A ?? years[0];
  const b = bundle.B ?? years[years.length - 1];
  if (a != null && b != null && a !== b) {
    out.push({
      value: `${a}–${b}`,
      label: labels.span,
      meta: years.length ? `${years.length} ${labels.years}` : undefined,
    });
  }

  return out;
}
