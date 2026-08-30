// src/components/RankBars/RankBars.jsx
// ============================================================
// Classement anime (« bar chart race ») — reutilisable.
// Les barres se reordonnent (Y) et se redimensionnent (largeur) a chaque
// changement d'annee. Echelle racine (pow 0.5) pour garder les petites
// valeurs visibles malgre l'outlier ; valeur exacte en bout de barre.
//
// COULEUR SEMANTIQUE divergente autour du repere `worldAvg` (mediane) :
//   • betterWhen="low"  (defaut) -> sous la mediane = bleu, au-dessus = ambre
//   • betterWhen="high"          -> inverse
// Zones teintees en arriere-plan (favorable / defavorable) + ligne de
// reference libellee. Couleurs lues depuis les tokens CSS -> light/dark auto.
// Props : data [{area,name,value}], unit, worldAvg, refLabel, betterWhen.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import * as d3 from "d3";
import gsap from "gsap";
import "./RankBars.scss";

const W = 1000;
const GAP = 8;
// Bornes de la hauteur de ligne, en unites de viewBox. En dessous du
// minimum le nom du territoire n est plus lisible ; au-dessus du maximum
// une barre isolee deviendrait un pave.
const ROW_MIN = 26;
const ROW_MAX = 62;
const ROW_0 = 30;
const M = { top: 16, right: 72, bottom: 38, left: 180 };

function cssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export default function RankBars({
  data,
  unit,
  worldAvg,
  refLabel,
  betterWhen = "low",
  format,
}) {
  // ------------------------------------------------------------------
  // LES LIGNES SE PARTAGENT LA HAUTEUR DISPONIBLE.
  //
  // La hauteur du viewBox etait 16 + 38 + n x 30 : elle ne dependait que du
  // NOMBRE de territoires. Rendue en `height: auto`, la figure tombait donc
  // ou elle voulait dans le panneau — trop courte a huit territoires, trop
  // longue a vingt-deux, jamais a la bonne taille. Les barres, elles,
  // gardaient 22 unites quelle que soit la place.
  //
  // On mesure la boite, on convertit sa hauteur en unites de viewBox, et on
  // la divise par le nombre de lignes. Le classement remplit exactement le
  // panneau, et les barres grossissent quand il y a de la place.
  // ------------------------------------------------------------------
  const wrapRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      setBox((prev) =>
        Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1
          ? prev
          : { w: r.width, h: r.height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowsRef = useRef(new Map());
  const barsRef = useRef(new Map());
  const valsRef = useRef(new Map());
  const known = useRef(new Set());

  const sorted = useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data],
  );
  const max = useMemo(() => d3.max(data, (d) => d.value) || 1, [data]);
  const min = useMemo(() => d3.min(data, (d) => d.value) ?? 0, [data]);
  const innerW = W - M.left - M.right;

  const rowH = useMemo(() => {
    const n = sorted.length || 1;
    if (!(box.w > 0 && box.h > 0)) return ROW_0;
    const availH = (W * box.h) / box.w;
    return Math.max(
      ROW_MIN,
      Math.min(ROW_MAX, (availH - M.top - M.bottom) / n),
    );
  }, [box, sorted.length]);

  const BAR_H = Math.max(12, rowH - GAP);
  const H = M.top + M.bottom + sorted.length * rowH;
  const plotH = H - M.top - M.bottom;

  const xScale = useMemo(
    () => d3.scalePow().exponent(0.5).domain([0, max]).range([0, innerW]),
    [max, innerW],
  );

  // UNE DIVERGENTE SUPPOSE UN MILIEU QUI VEUT DIRE QUELQUE CHOSE.
  //
  // Sans `worldAvg`, le composant prenait (min + max) / 2 comme pivot : un
  // nombre sans signification, autour duquel il peignait quand meme deux
  // zones « favorable » et « defavorable ». Un jugement etait donc porte sur
  // une frontiere arbitraire — et l escale Impact, qui n a pas de repere a
  // fournir, l affichait sur un simple cumul.
  //
  // Sans repere, on retombe donc sur une GRANDEUR : rampe sequentielle, pas
  // de zones, pas de ligne. C est exactement ce que dit la cle de lecture
  // (« une seule teinte… c est une grandeur, pas un jugement »).
  const diverging = Number.isFinite(worldAvg) && worldAvg > min && worldAvg < max;

  const pivot = useMemo(
    () => (diverging ? worldAvg : (min + max) / 2),
    [diverging, worldAvg, min, max],
  );

  // COULEUR DIVERGENTE — LA VALIDEE, PAS VERT<->ROUGE.
  // Elle allait de --c-positive a --c-negative, c'est-a-dire du vert au
  // rouge : mesuree a dE 4,1 sous deuteranopie, la paire dont les deux poles
  // sont la MEME couleur pour pres d'un homme sur douze. Les jetons `div`
  // portent la divergente bleu<->ambre du systeme, declaree dans les deux
  // themes, pire cas dE 20,5. Le repere central prend le jeton neutre de la
  // rampe plutot que l'accent, qui n'a rien d'un milieu.
  const colorFor = useMemo(() => {
    if (!diverging) {
      // UNE SEULE TEINTE, ET C EST VOULU.
      //
      // Une rampe a bien ete essayee ici. Mesuree sur les donnees reelles de
      // l escale : quatorze territoires sur quinze tombaient entre #4e58a1 et
      // #818ac5 — un ecart que personne ne voit, parce qu un seul territoire
      // occupe presque toute l amplitude. La rampe ne disait donc rien, tout
      // en ayant l air de dire quelque chose.
      //
      // La LONGUEUR porte deja la valeur, et elle la porte bien. La couleur
      // n a rien a encoder de plus : un ton unique, lisible sur les deux
      // fonds (jeton 700 de la sequentielle — clair sur le sombre, fonce sur
      // le clair).
      const flat = cssVar("--c-seq-700", "#adb5e4");
      return () => flat;
    }
    const pos = cssVar("--c-div-1", "#4f8fd0");
    const neg = cssVar("--c-div-9", "#d99b3c");
    const mid = cssVar("--c-div-5", "#9aa3b2");
    const lowColor = betterWhen === "high" ? neg : pos;
    const highColor = betterWhen === "high" ? pos : neg;
    const belowS = d3.scaleLinear().domain([min, pivot]).range([0, 1]).clamp(true);
    const aboveS = d3.scaleLinear().domain([pivot, max]).range([0, 1]).clamp(true);
    const belowI = d3.interpolateRgb(lowColor, mid);
    const aboveI = d3.interpolateRgb(mid, highColor);
    return (v) => (v <= pivot ? belowI(belowS(v)) : aboveI(aboveS(v)));
  }, [diverging, min, max, pivot, betterWhen]);

  // Les valeurs etaient ecrites brutes : « 1240734 ». Sept chiffres colles
  // ne se lisent pas. On prend le formateur de la page s il y en a un, sinon
  // un groupage par milliers.
  const fmt2 = useMemo(() => {
    if (typeof format === "function") return format;
    const grouped = d3.format(",");
    return (v) =>
      Math.abs(v) >= 1000
        ? grouped(Math.round(v)).replace(/,/g, "\u202f")
        : d3.format(".2~f")(v);
  }, [format]);
  const refX = xScale(pivot);
  const goodLeft = betterWhen !== "high";

  const targets = useMemo(() => {
    const m = new Map();
    sorted.forEach((d, i) => {
      m.set(d.area, {
        y: M.top + i * rowH,
        w: Math.max(0, xScale(d.value)),
        value: d.value,
      });
    });
    return m;
  }, [sorted, xScale, rowH]);

  useLayoutEffect(() => {
    let i = 0;
    targets.forEach((tgt, area) => {
      const g = rowsRef.current.get(area);
      const bar = barsRef.current.get(area);
      const v = valsRef.current.get(area);
      const fill = colorFor(tgt.value);
      const isKnown = known.current.has(area);
      const valX = M.left + tgt.w + 8;
      if (!isKnown) {
        if (g) gsap.set(g, { y: tgt.y, opacity: 0 });
        if (bar) gsap.set(bar, { attr: { width: tgt.w, fill } });
        if (v) gsap.set(v, { attr: { x: valX } });
        if (g)
          gsap.to(g, {
            opacity: 1,
            duration: 0.4,
            delay: i * 0.02,
            ease: "power1.out",
          });
        known.current.add(area);
      } else {
        if (g)
          gsap.to(g, {
            y: tgt.y,
            duration: 0.85,
            delay: i * 0.01,
            ease: "power2.inOut",
          });
        if (bar)
          gsap.to(bar, {
            attr: { width: tgt.w, fill },
            duration: 0.85,
            ease: "power2.inOut",
          });
        if (v)
          gsap.to(v, {
            attr: { x: valX },
            duration: 0.85,
            ease: "power2.inOut",
          });
      }
      if (v) v.textContent = fmt2(tgt.value);
      i += 1;
    });
    Array.from(known.current).forEach((a) => {
      if (!targets.has(a)) known.current.delete(a);
    });
  }, [targets, colorFor, fmt2]);

  return (
    <div ref={wrapRef} className="rank">
      <svg className="rank__svg" viewBox={`0 0 ${W} ${H}`} role="img">
        {diverging && (
          <>
            <rect className={`rank__zone ${goodLeft ? "rank__zone--good" : "rank__zone--bad"}`} x={M.left} y={M.top} width={Math.max(0, refX)} height={plotH} />
            <rect className={`rank__zone ${goodLeft ? "rank__zone--bad" : "rank__zone--good"}`} x={M.left + refX} y={M.top} width={Math.max(0, innerW - refX)} height={plotH} />

            <g className="rank__ref-g" transform={`translate(${M.left + refX},0)`}>
              <line className="rank__ref" y1={M.top} y2={M.top + plotH} />
              <text className="rank__ref-label" y={H - M.bottom + 24} textAnchor="middle">
                {refLabel} {"\u00b7"} {fmt2(pivot)}
              </text>
            </g>
          </>
        )}

        {data.map((d) => (
          <g
            key={d.area}
            ref={(el) => {
              if (el) rowsRef.current.set(d.area, el);
              else rowsRef.current.delete(d.area);
            }}
          >
            <text className="rank__name" x={M.left - 12} y={BAR_H / 2} dy="0.35em" textAnchor="end">{d.name}</text>
            <rect
              ref={(el) => {
                if (el) barsRef.current.set(d.area, el);
                else barsRef.current.delete(d.area);
              }}
              className="rank__bar"
              x={M.left}
              y={0}
              height={BAR_H}
              rx={5}
            />
            <text
              ref={(el) => {
                if (el) valsRef.current.set(d.area, el);
                else valsRef.current.delete(d.area);
              }}
              className="rank__val"
              y={BAR_H / 2}
              dy="0.35em"
              textAnchor="start"
            />
          </g>
        ))}

        {/* A gauche, sous l origine des barres : au centre il tombait sur le
            libelle de la ligne de repere. */}
        <text className="rank__axis-title" x={M.left} y={H - 8} textAnchor="start">{unit}</text>
      </svg>
    </div>
  );
}