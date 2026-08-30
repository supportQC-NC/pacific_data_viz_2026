// src/components/BiodiversityReef/BiodiversityReef.jsx
// ============================================================
// SECTION SIGNATURE #3 — « Le récif » (Home), pendant vivant du verre d'eau
// et de la cellule d'énergie. Même ESPRIT (un objet réel qui répond à une
// donnée), animation différente : un RÉCIF qui REPREND VIE — couleurs +
// poissons — selon l'INDICE LISTE ROUGE (risque d'extinction des espèces,
// ODD 15.5.1, indicateur ER_RSK_LST, UICN), via le dataset live `redList`.
//
// Lecture honnête :
//   • grand nombre = indice réel (0 → 1 ; 1 = aucun risque) ;
//   • le récif encode la VITALITÉ relative au Pacifique, NORMALISÉE sur
//     l'amplitude observée : le territoire le plus préservé = récif pleinement
//     vivant, le plus menacé = totalement blanchi — l'écart est maximal et
//     lisible. Coraux + poissons quand l'indice est haut ; squelettes blanchis
//     et coraux rabougris quand il baisse (blanchissement rendu visible) ;
//   • une tendance « depuis {année} » montre le sens réel de l'évolution.
//
// Aucune valeur inventée : seuls les territoires AYANT une donnée (dernière
// année connue) sont proposés ; vitalité et tendance dérivées de la série
// officielle. Houle + taille des coraux + dérive des poissons pilotées par rAF
// (attributs SVG + une custom property --v pour l'opacité) ; transition GSAP.
// prefers-reduced-motion respecté. Tokens uniquement, FR/EN, zéro inline.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import gsap from "gsap";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { useLang } from "../../store/context/langContext";
import { isPict, pictName } from "../../i18n/pictNames";
import flagUrl from "../../i18n/flagUrl";
import useInView from "../../hooks/UseInView";
import "./BiodiversityReef.scss";

// ---------------------------------------------------------------------------
// LE RÉCIF, REDESSINÉ.
//
// Les six coraux étaient : une arche arrondie (qui se lit comme une pierre
// tombale), un Y, une deuxième arche, TROIS BARRES VERTICALES, une troisième
// arche, un second Y. Rien là-dedans ne ressemble à un corail, et trois des
// six sont la même forme à l'échelle près.
//
// Ils sont remplacés par six silhouettes réelles, toutes reconnaissables :
// corail de table (Acropora), cerveau de Neptune, anémone, corne de cerf,
// gorgone en éventail, corail digité. Trois pleins, trois au trait — la
// répartition d'origine, que le fondu squelette/vivant exige.
//
// Les géométries sont en coordonnées LOCALES : le pied du corail est en (0,0)
// et il pousse vers les y négatifs. Le placement est porté par le groupe
// parent — c'est ce qui permet de faire GRANDIR chaque corail depuis sa base
// au lieu de l'écraser sur place.
// ---------------------------------------------------------------------------

// Chaque corail porte désormais sa propre cote au sol (`y`) : une constante
// unique ne pouvait pas suivre le relief du banc de sable.

// Particules en suspension, semées à la main : réparties au hasard elles
// feraient du bruit, alignées elles feraient une grille.
const MOTES = [
  [62, 52, 1.6], [118, 34, 1.2], [176, 62, 1.8], [214, 28, 1.1],
  [262, 48, 1.5], [312, 70, 1.3], [88, 108, 1.4], [196, 128, 1.2],
  [284, 116, 1.6], [148, 96, 1.1], [334, 40, 1.2], [40, 84, 1.3],
];

const CORALS = [
  // Corail de table : un pied court, un plateau large. C'est la silhouette la
  // plus identifiable d'un récif vu de côté.
  {
    x: 48,
    y: 201,
    cls: "reef__c1",
    fill: true,
    d: "M-4,0 L-3,-15 L3,-15 L4,0 Z M-27,-16 Q-15,-27 0,-26 Q15,-27 27,-16 Q14,-11 0,-11 Q-14,-11 -27,-16 Z",
  },
  // Corne de cerf : un tronc et quatre ramures qui se dédoublent. Les branches
  // ne partent pas du même point, sinon on obtient un Y.
  {
    x: 104,
    y: 202,
    cls: "reef__c2",
    d: "M0,0 L0,-18 M0,-14 L-11,-26 M-11,-26 L-15,-38 M-11,-26 L-3,-35 M0,-16 L11,-27 M11,-27 L16,-39 M11,-27 L6,-36 M0,-18 L1,-30",
  },
  // Cerveau de Neptune : un dôme bas, à bord lobé. Le lisser en demi-cercle
  // en ferait une bulle.
  {
    x: 156,
    y: 205,
    cls: "reef__c3",
    fill: true,
    d: "M-24,0 Q-26,-15 -17,-22 Q-9,-28 0,-27 Q9,-28 17,-22 Q26,-15 24,0 Z",
  },
  // Gorgone : un éventail de nervures qui s'ouvrent depuis un pied unique,
  // reliées par deux arcs. Sans les arcs, ce sont des herbes.
  {
    x: 212,
    y: 204,
    cls: "reef__c4",
    d: "M0,0 L0,-10 M0,-10 L-18,-34 M0,-10 L-9,-38 M0,-10 L0,-42 M0,-10 L9,-38 M0,-10 L18,-34 M-13,-27 Q0,-33 13,-27 M-16,-32 Q0,-40 16,-32",
  },
  // Anémone : un bulbe et des tentacules courts en couronne.
  {
    x: 268,
    y: 197,
    cls: "reef__c5",
    fill: true,
    d: "M-13,0 Q-16,-14 0,-17 Q16,-14 13,0 Z M-15,-16 Q-19,-27 -10,-29 Q-6,-22 -8,-16 Z M-6,-18 Q-8,-31 0,-32 Q8,-31 6,-18 Z M8,-16 Q6,-22 10,-29 Q19,-27 15,-16 Z",
  },
  // Corail digité : des doigts de hauteurs inégales, à bout rond. Réguliers,
  // ils feraient un code-barres — c'était exactement le défaut d'avant.
  {
    x: 320,
    y: 196,
    cls: "reef__c6",
    d: "M-12,0 L-12,-19 M-6,0 L-6,-27 M0,0 L0,-22 M6,0 L6,-31 M12,0 L12,-16",
  },
];

// Trois silhouettes de poisson au lieu d'une seule répétée six fois : un
// poisson de récif trapu, un poisson allongé, et un petit rond. Chacune porte
// son œil — c'est ce qui fait qu'on lit un animal et non une flèche.
const FISH_SHAPES = {
  reef: {
    body: "M10,0 Q4,-7 -5,-5 L-14,-9 L-11,0 L-14,9 L-5,5 Q4,7 10,0 Z",
    eye: [6, -1.6, 1.3],
    fin: "M-2,-4 Q0,-9 4,-5",
  },
  long: {
    body: "M14,0 Q6,-4 -6,-3 L-15,-7 L-12,0 L-15,7 L-6,3 Q6,4 14,0 Z",
    eye: [9, -1.1, 1.1],
    fin: "M0,-3 Q3,-7 7,-3",
  },
  round: {
    body:
      "M-7,0 Q-3,-7 4,-6 Q10,-4 10,0 Q10,4 4,6 Q-3,7 -7,0 Z" +
      " M-7,0 L-13,-6 L-11,0 L-13,6 Z",
    eye: [5, -2, 1.2],
    fin: "M0,-5 Q3,-9 6,-5",
  },

  // Tortue verte, de profil : dossière bombée, plastron plat, deux nageoires
  // décalées (les quatre visibles à la fois donneraient une araignée).
  turtle: {
    body:
      "M-14,2 Q-16,-9 -2,-12 Q13,-14 17,-4 Q19,2 12,5 Q-2,9 -14,2 Z" +
      " M17,-4 Q24,-8 27,-3 Q28,2 22,3 Q18,2 17,-1 Z" +
      " M-2,5 Q0,13 8,12 Q9,7 5,5 Z" +
      " M-11,3 Q-16,10 -22,7 Q-20,2 -14,1 Z" +
      " M-14,-4 Q-21,-9 -24,-4 Q-21,-1 -15,-1 Z",
    eye: [23, -3, 1.1],
    fin: null,
    lines: "M-9,-6 Q0,-9 9,-6 M-6,-1 Q1,-3 8,-1",
  },

  // Raie manta, vue de trois quarts : deux ailes en arc, une queue fine. Une
  // raie symétrique et à plat se lit comme un cerf-volant.
  // Raie manta. La première version était deux arcs symétriques partant du
  // même point : une couverture, pas un animal. Ce qui fait lire une manta,
  // c'est l'aile TRIANGULAIRE en flèche, les deux cornes céphaliques à
  // l'avant — elle n'a ça qu'elle — et la queue en fouet, plus longue que le
  // corps. Museau vers les x positifs, comme tous les autres.
  ray: {
    body:
      "M15,0 C10,-8 -2,-15 -14,-19 C-24,-22 -30,-20 -26,-13" +
      " C-22,-7 -16,-3 -12,0 C-16,3 -22,7 -26,13 C-30,20 -24,22 -14,19" +
      " C-2,15 10,8 15,0 Z" +
      " M15,-1 L23,-8 L18,-1 Z" +
      " M15,1 L23,8 L18,1 Z" +
      " M-11,-1.8 Q-27,-0.6 -47,1 Q-27,1.8 -11,1.8 Z",
    eye: [10, -3.4, 1.1],
    fin: null,
    // Les deux taches claires des épaules : le marquage qui sert à
    // identifier une manta individuellement.
    lines: "M3,-6 Q-4,-10 -11,-11 M3,6 Q-4,10 -11,11",
  },

  // Requin de récif : museau pointu, dorsale, caudale échancrée. Le ventre
  // clair et la ligne latérale sont ce qui empêche la forme de faire dauphin.
  shark: {
    body:
      "M26,0 Q14,-8 -4,-7 Q-16,-6 -22,-2 L-32,-9 L-28,0 L-32,9 L-22,2 Q-14,7 -2,7 Q14,7 26,0 Z" +
      " M2,-7 L6,-17 L13,-6 Z" +
      " M-6,7 L-9,13 L-1,8 Z",
    eye: [18, -2, 1.2],
    fin: null,
    lines: "M-16,0 Q0,-1 18,-1",
  },
};

// LES ESPÈCES EMBLÉMATIQUES SONT LA MESURE.
//
// L'animation révèle les animaux dans l'ordre du tableau : les derniers
// n'apparaissent qu'aux indices élevés. En plaçant la tortue, la raie et le
// requin en fin de liste, on obtient exactement ce que dit l'indicateur — un
// récif préservé garde ses grands animaux, un récif sous pression ne garde que
// les petits. Ce n'est pas une décoration : c'est l'encodage.
//
// Ils nagent aussi PLUS LENTEMENT (`sp` bas) et plus loin : un requin qui
// file comme un poisson-papillon casse l'échelle du dessin.
const FISH = [
  { x: 96, y: 84, cls: "reef__f1", sp: 0.5, off: 0.0, sh: "reef", s: 1.0 },
  { x: 158, y: 66, cls: "reef__f2", sp: 0.42, off: 1.1, sh: "long", s: 0.9 },
  { x: 224, y: 94, cls: "reef__f3", sp: 0.55, off: 2.0, sh: "round", s: 0.85 },
  { x: 288, y: 74, cls: "reef__f1", sp: 0.46, off: 0.7, sh: "long", s: 0.78 },
  { x: 124, y: 122, cls: "reef__f2", sp: 0.6, off: 1.7, sh: "round", s: 0.7 },
  { x: 252, y: 130, cls: "reef__f3", sp: 0.5, off: 2.6, sh: "reef", s: 0.82 },
  { x: 152, y: 40, cls: "reef__f4", sp: 0.22, off: 0.4, sh: "turtle", s: 1.0, amp: 30 },
  { x: 284, y: 58, cls: "reef__f5", sp: 0.18, off: 2.2, sh: "ray", s: 1.2, amp: 34 },
  { x: 110, y: 152, cls: "reef__f6", sp: 0.15, off: 1.4, sh: "shark", s: 1.15, amp: 52 },
];

function median(arr) {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function firstFinite(serie) {
  for (let i = 0; i < serie.length; i += 1)
    if (Number.isFinite(serie[i].value)) return serie[i];
  return null;
}
function lastFinite(serie) {
  for (let i = serie.length - 1; i >= 0; i -= 1)
    if (Number.isFinite(serie[i].value)) return serie[i];
  return null;
}
function fillTpl(str, map) {
  return Object.entries(map).reduce(
    (s, [k, val]) => s.split(`{${k}}`).join(String(val)),
    String(str),
  );
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default function BiodiversityReef({ embed = false, code = null } = {}) {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView, visible] = useInView({ threshold: 0.25 });

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const bio = useSelector(selectDataset("redList"));

  useEffect(() => {
    dispatch(loadDataset("redList"));
  }, [dispatch]);

  const status = bio.status;
  const ready = status === "succeeded" && bio.data;

  /* L'Indice Liste Rouge est 0–1 ; on tolère un flux en %. */
  const indexMode = useMemo(() => {
    if (!ready) return true;
    let max = 0;
    Object.values(bio.data.byArea).forEach((s) =>
      s.forEach((p) => {
        if (Number.isFinite(p.value) && p.value > max) max = p.value;
      }),
    );
    return max <= 1.5;
  }, [ready, bio.data]);

  const norm = useCallback(
    (value) => clamp01(indexMode ? value : value / 100),
    [indexMode],
  );

  /* Liste : index réel + tendance, puis VITALITÉ normalisée sur l'amplitude
     observée (min..max du Pacifique) → écart maximal entre préservé et menacé. */
  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(bio.data.byArea)
      .filter(([code]) => isPict(code))
      .map(([code, serie]) => {
        const pt = lastFinite(serie);
        if (!pt) return null;
        const f = firstFinite(serie);
        return {
          code,
          name: pictName(code, lang),
          index: norm(pt.value),
          year: pt.year,
          delta: f ? norm(pt.value) - norm(f.value) : null,
          fromYear: f ? f.year : null,
        };
      })
      .filter(Boolean);
    if (!raw.length) return [];
    const idxs = raw.map((o) => o.index);
    const vMin = Math.min(...idxs);
    const vMax = Math.max(...idxs);
    const span = vMax - vMin || 1;
    return raw
      .map((o) => ({ ...o, v: clamp01((o.index - vMin) / span) }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [ready, bio.data, lang, norm]);

  const byCode = useMemo(() => {
    const m = {};
    list.forEach((o) => {
      m[o.code] = o;
    });
    return m;
  }, [list]);

  const medianIndex = useMemo(() => median(list.map((o) => o.index)), [list]);
  const extremes = useMemo(() => {
    if (!list.length) return null;
    let best = list[0];
    let least = list[0];
    list.forEach((o) => {
      if (o.index > best.index) best = o;
      if (o.index < least.index) least = o;
    });
    return { best, least };
  }, [list]);

  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(byCode.FJ ? "FJ" : list[0].code);
    }
  }, [list, selected, byCode]);

  const sel = selected ? byCode[selected] : null;
  useEffect(() => {
    if (embed && code) setSelected(code);
  }, [embed, code]);

  /* ----------- Animation : vitalité du récif ----------- */
  const svgRef = useRef(null);
  const numberRef = useRef(null);
  const coralRefs = useRef([]);
  const fishRefs = useRef([]);
  const animObj = useRef({ v: 0, idx: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const v = animObj.current.v;
      if (svgRef.current) svgRef.current.style.setProperty("--v", v.toFixed(3));
      if (numberRef.current)
        numberRef.current.textContent = animObj.current.idx.toFixed(2);

      const swing = reduced ? 0 : 1;

      // CHAQUE CORAIL POUSSE, LE RÉCIF NE S'APLATIT PAS.
      //
      // Avant : deux facteurs différents, 0,40 en hauteur et 0,72 en largeur,
      // appliqués à TOUS les coraux en même temps. Un récif en mauvaise santé
      // n'était donc pas clairsemé, il était ÉCRASÉ — chaque colonie gardait
      // sa place et perdait ses proportions, ce qui ne veut rien dire.
      //
      // Maintenant chaque colonie a sa propre progression, décalée, et grandit
      // sans se déformer : les premières tiennent, les dernières restent des
      // recrues. C'est la même mécanique que le bosquet de l'escale 05.
      const nc = CORALS.length;
      coralRefs.current.forEach((node, i) => {
        if (!node) return;
        const p = clamp01((v - i / (nc + 1)) * 1.9);
        const grow = 1 - (1 - p) * (1 - p);
        const sc = (0.08 + 0.92 * grow).toFixed(3);
        const a = 3.6 * grow * swing * Math.sin(phase * 0.9 + i * 1.3);
        node.setAttribute(
          "transform",
          `rotate(${a.toFixed(2)}) scale(${sc})`,
        );
      });

      // Poissons : dérive + apparition progressive selon la vitalité.
      fishRefs.current.forEach((node, i) => {
        if (!node) return;
        const f = FISH[i];
        // `amp` : les grands animaux couvrent plus de distance par battement.
        const amp = f.amp || 20;
        const tx = f.x + (reduced ? 0 : amp * Math.sin(phase * f.sp + f.off));
        const ty = f.y + (reduced ? 0 : 6 * Math.sin(phase * 0.8 + f.off));
        const dir = Math.cos(phase * f.sp + f.off) >= 0 ? 1 : -1;
        // La tortue, la raie et le requin sont en fin de tableau : ils
        // n'apparaissent donc qu'aux indices élevés.
        const late = i >= FISH.length - 3;
        const p = clamp01((v - i / (FISH.length + 0.6)) * (late ? 3 : 2.2));

        // POUR LES GRANDS ANIMAUX, C'EST LA TAILLE QUI DIT LA PRÉSENCE.
        //
        // Ils apparaissaient en fondu, comme les petits poissons. À
        // mi-apparition la raie était donc à 0,64 d'opacité — et les poissons
        // qui passaient DERRIÈRE elle se voyaient au travers. Un animal de
        // deux mètres d'envergure ne se traverse pas du regard.
        //
        // Ils deviennent opaques presque tout de suite (×12) et arrivent de
        // LOIN : leur échelle monte de 0,45 à 1. On les voit s'approcher au
        // lieu de se matérialiser, et ils masquent ce qu'ils recouvrent.
        const grow = 1 - (1 - p) * (1 - p);
        const sc = (f.s || 1) * (late ? 0.45 + 0.55 * grow : 1);
        node.setAttribute(
          "transform",
          `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${(dir * sc).toFixed(3)} ${sc.toFixed(3)})`,
        );
        node.setAttribute(
          "opacity",
          (late ? clamp01((p - 0.02) * 12) : p).toFixed(3),
        );
      });
    },
    [reduced],
  );

  useEffect(() => {
    if (inView) startedRef.current = true;
    const tv = sel ? sel.v : 0;
    const ti = sel ? sel.index : 0;
    if (reduced) {
      animObj.current.v = tv;
      animObj.current.idx = ti;
      draw(0);
      return undefined;
    }
    const tw = gsap.to(animObj.current, {
      v: tv,
      idx: ti,
      duration: 1.2,
      ease: "power2.out",
    });
    return () => tw.kill();
  }, [inView, sel, reduced, draw]);

  useEffect(() => {
    if (reduced) return undefined;
    if (!visible) return undefined;
    let raf = 0;
    let phase = 0;
    let last = performance.now();
    const loop = (now) => {
      phase += (now - last) / 1000;
      last = now;
      draw(phase);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, visible, draw]);

  const loading = status === "loading" || status === "idle";
  const failed = status === "failed";
  const empty = ready && list.length === 0;

  const idxText = sel ? sel.index.toFixed(2) : "0.00";

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 0.0005)
      return (
        <span className="reef__trend reef__trend--flat">
          {fillTpl(t("home.biodiv.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d < 0)
      return (
        <span className="reef__trend reef__trend--down">
          {fillTpl(t("home.biodiv.trend_down"), {
            n: d.toFixed(3),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="reef__trend reef__trend--up">
        {fillTpl(t("home.biodiv.trend_up"), {
          n: d.toFixed(3),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.biodiv.aria"), {
        area: sel.name,
        n: idxText,
        year: sel.year,
      })
    : t("home.biodiv.title");

  return (
    <section
      className={`reef ${embed ? "reef--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="reef__inner container">
        <header className="reef__head">
          <p className="eyebrow reef__kicker">{t("home.biodiv.kicker")}</p>
          <h2 className="reef__title">{t("home.biodiv.title")}</h2>
          <p className="reef__lead">{t("home.biodiv.lead")}</p>
        </header>

        {loading && <p className="reef__state">{t("home.biodiv.loading")}</p>}
        {(failed || empty) && (
          <p className="reef__state reef__state--err">
            {t("home.biodiv.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="reef__stage">
            {/* Texte : contrôles + lecture */}
            <aside className="reef__aside">
              <div className="reef__controls">
                <label className="reef__field">
                  <span className="reef__field-label">
                    {t("home.biodiv.select_label")}
                  </span>
                  <span className="reef__select">
                    <img
                      className="reef__flag"
                      src={flagUrl(sel.code)}
                      alt=""
                      aria-hidden="true"
                    />
                    <select
                      className="reef__native"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                      aria-label={t("home.biodiv.select_label")}
                    >
                      {list.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <span className="reef__chevron" aria-hidden="true">
                      ▾
                    </span>
                  </span>
                </label>

                {extremes && (
                  <div className="reef__chips">
                    <button
                      type="button"
                      className="reef__chip"
                      onClick={() => setSelected(extremes.best.code)}
                    >
                      {t("home.biodiv.highest")}
                      <em>{extremes.best.index.toFixed(2)}</em>
                    </button>
                    <button
                      type="button"
                      className="reef__chip"
                      onClick={() => setSelected(extremes.least.code)}
                    >
                      {t("home.biodiv.lowest")}
                      <em>{extremes.least.index.toFixed(2)}</em>
                    </button>
                  </div>
                )}
              </div>

              <div className="reef__readout">
                <p className="reef__index">
                  <span ref={numberRef} className="reef__index-num">
                    {idxText}
                  </span>
                </p>
                <p className="reef__index-cap">
                  {t("home.biodiv.index_caption")}
                </p>
                <p className="reef__name">
                  <img
                    className="reef__name-flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  {sel.name}
                </p>
                <p className="reef__year">
                  {fillTpl(t("home.biodiv.year_label"), { year: sel.year })}
                  {trendEl ? <> · {trendEl}</> : null}
                </p>

                {medianIndex != null && (
                  <p className="reef__legend">
                    {fillTpl(t("home.biodiv.median_label"), {
                      n: medianIndex.toFixed(2),
                    })}
                  </p>
                )}
              </div>
            </aside>

            {/* Le récif */}
            <figure className="reef__viz">
              <svg
                className="reef__svg"
                ref={svgRef}
                viewBox="0 0 360 240"
                role="img"
                aria-label={svgLabel}
              >
                {/* Rais de lumière. Ils étaient verticaux et à bords nets :
                    trois piliers gris plantés dans l'eau. Inclinés, plus larges
                    en surface qu'au fond, ils redeviennent de la lumière. */}
                <g className="reef__rays" aria-hidden="true">
                  <polygon points="58,0 104,0 84,200 70,200" />
                  <polygon points="168,0 206,0 190,200 180,200" />
                  <polygon points="276,0 330,0 302,200 288,200" />
                </g>

                {/* Particules en suspension : ce qui donne à une eau sa
                    profondeur, ce n'est pas sa couleur, c'est ce qui flotte
                    dedans. */}
                <g className="reef__motes" aria-hidden="true">
                  {MOTES.map(([cx, cy, r], i) => (
                    <circle key={i} cx={cx} cy={cy} r={r} />
                  ))}
                </g>

                {/* Le fond. C'était un rectangle à bord tracé, qui se lisait
                    comme une boîte noire posée sur l'image. Un banc de sable
                    sans contour, plus une pente et deux blocs. */}
                <path
                  className="reef__bed"
                  d="M0,208 Q24,203 48,201 Q76,200 104,202 Q130,204 156,205 Q184,205 212,204 Q240,201 268,197 Q294,195 320,196 Q340,197 360,199 L360,240 L0,240 Z"
                />
                <path
                  className="reef__bed reef__bed--far"
                  d="M0,214 Q90,204 180,212 Q270,220 360,210 L360,240 L0,240 Z"
                />
                <g className="reef__rocks" aria-hidden="true">
                  <ellipse cx="76" cy="205" rx="17" ry="6" />
                  <ellipse cx="244" cy="202" rx="13" ry="5" />
                  <ellipse cx="332" cy="203" rx="10" ry="4" />
                </g>

                {/* Coraux. Le groupe extérieur POSE le corail sur le fond, le
                    groupe intérieur l'anime autour de son pied : il grandit
                    depuis sa base, il ne s'écrase pas sur place. */}
                {CORALS.map((c, i) => (
                  <g key={i} transform={`translate(${c.x} ${c.y})`}>
                    <g
                      ref={(n) => {
                        coralRefs.current[i] = n;
                      }}
                    >
                      <path
                        className={`reef__ghost ${c.fill ? "" : "reef__ghost--line"}`}
                        d={c.d}
                      />
                      <path className={`reef__alive ${c.cls}`} d={c.d} />
                    </g>
                  </g>
                ))}

                {/* Poissons */}
                {FISH.map((f, i) => (
                  <g
                    key={i}
                    ref={(n) => {
                      fishRefs.current[i] = n;
                    }}
                    opacity="0"
                  >
                    <path
                      className={`reef__fish ${f.cls}`}
                      d={FISH_SHAPES[f.sh].body}
                    />
                    {FISH_SHAPES[f.sh].fin ? (
                      <path
                        className={`reef__fin ${f.cls}`}
                        d={FISH_SHAPES[f.sh].fin}
                      />
                    ) : null}
                    {FISH_SHAPES[f.sh].lines ? (
                      <path
                        className="reef__detail"
                        d={FISH_SHAPES[f.sh].lines}
                      />
                    ) : null}
                    <circle
                      className="reef__eye"
                      cx={FISH_SHAPES[f.sh].eye[0]}
                      cy={FISH_SHAPES[f.sh].eye[1]}
                      r={FISH_SHAPES[f.sh].eye[2]}
                    />
                  </g>
                ))}
              </svg>
              <figcaption className="reef__viz-cap">
                {t("home.biodiv.vitality_caption")}
              </figcaption>
            </figure>
          </div>
        )}

        <p className="reef__source">{t("home.biodiv.source")}</p>
      </div>
    </section>
  );
}