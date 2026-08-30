// src/components/EventTimeline/EventTimeline.jsx
// ============================================================
// Frise d'événements : chaque catastrophe = un cercle positionné à
// son année (x), dispersé en essaim (force collide), rayon ∝ valeur,
// teinte ∝ intensité. Donne à voir le RYTHME des catastrophes et les
// années qui ont frappé fort. Survol → infobulle (nom + année + valeur).
// Props :
//   events   : [{ area, name, year, value }]
//   unit     : string
//   format   : (n) => string   (formatage de la valeur)
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import "./EventTimeline.scss";

// Relit les jetons quand [data-theme] change : sans cela la frise garderait
// les couleurs du theme dans lequel elle a ete montee.
function useThemeTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return undefined;
    const mo = new MutationObserver(() => setTick((n) => n + 1));
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
  }, []);
  return tick;
}

const W = 1000;
// Hauteur de repli, avant la premiere mesure du conteneur.
const H0 = 280;
const M = { top: 20, right: 20, bottom: 36, left: 20 };

export default function EventTimeline({
  events = [],
  unit = "",
  format = (n) => String(n),
}) {
  // ------------------------------------------------------------------
  // LA FRISE OCCUPE LA HAUTEUR QU ON LUI DONNE.
  //
  // Le viewBox etait fige a 1000 x 280 et le SVG regle sur sa largeur
  // (`height: auto`). Dans un panneau d escale, dont la hauteur est fixe,
  // la frise se dessinait donc dans le quart superieur et laissait un
  // grand vide dessous — et l essaim, ecrase sur 280 unites, empilait ses
  // cercles au lieu de les etaler.
  //
  // On mesure le conteneur et on donne au viewBox le MEME rapport : le
  // dessin remplit exactement la boite, sans deformation (les cercles
  // gardent leur rayon en pixels, l echelle horizontale ne bouge pas), et
  // l essaim recupere la place verticale pour respirer.
  // ------------------------------------------------------------------
  const theme = useThemeTick();
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

  const H =
    box.w > 0 && box.h > 0
      ? Math.min(900, Math.max(200, Math.round((W * box.h) / box.w)))
      : H0;

  const data = useMemo(
    () => events.filter((e) => Number.isFinite(e.value) && e.value > 0),
    [events],
  );

  const x = useMemo(() => {
    const ext = d3.extent(data.length ? data.map((d) => d.year) : [2005, 2023]);
    return d3
      .scaleLinear()
      .domain([ext[0] - 0.5, ext[1] + 0.5])
      .range([M.left, W - M.right]);
  }, [data]);

  const max = useMemo(() => d3.max(data, (d) => d.value) || 1, [data]);
  // Le rayon suit la place disponible. Fixe a 30 unites, il avait ete regle
  // pour un viewBox de 280 de haut ; dans un panneau deux fois plus haut,
  // l essaim restait une bande mince au milieu d un grand vide. En le liant
  // a la hauteur, les cercles grossissent, se poussent davantage, et
  // l essaim occupe reellement la scene. La borne haute evite qu un seul
  // evenement hors norme ne devienne un disque qui masque ses voisins.
  const r = useMemo(() => {
    const rMax = Math.max(26, Math.min(H * 0.11, 66));
    return d3.scaleSqrt().domain([0, max]).range([rMax / 10, rMax]);
  }, [max, H]);
  // LA TEINTE SUIT LES JETONS, PAS DEUX HEX ECRITS EN DUR.
  //
  // C etait un degrade ambre -> rouge, code en clair. Trois problemes : il
  // ne suivait pas le theme (les canvas et les SVG ne resolvent pas var()
  // tout seuls, mais on peut lire la valeur calculee) ; il faisait DEUX
  // teintes la ou la cle de lecture en annonce une seule ; et son extremite
  // rouge lisait comme une alerte alors que la mesure est une grandeur.
  //
  // On prend donc la rampe sequentielle du systeme, dans le sens declare
  // par les deux themes : jeton 200 pour le plus faible, 900 pour le plus
  // fort. Sur fond sombre le haut de l echelle est le jeton clair, sur fond
  // clair le fonce — la salience suit la valeur dans les deux cas.
  const color = useMemo(() => {
    // `theme` n est pas lu : il est la pour que le memo se refasse quand le
    // theme bascule, puisque les jetons sont lus dans le DOM.
    void theme;
    const read = (name, fallback) => {
      if (typeof window === "undefined") return fallback;
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
      return v || fallback;
    };
    // On part du jeton 400 et non du 100 : la frise compte une centaine de
    // cercles, dont beaucoup de tres petits. Au bas de la rampe complete ils
    // etaient a peine detachables du fond sombre — un evenement declare doit
    // rester visible, meme modeste. Le sens est preserve : plus bas = plus
    // discret, plus haut = plus detache.
    const ramp = d3.interpolateRgb(
      read("--c-seq-400", "#747dbc"),
      read("--c-seq-900", "#d3daff"),
    );
    // Racine, comme le rayon : sans compression, un evenement hors norme
    // ecrase tous les autres sur le bas de la rampe.
    const t = d3.scalePow().exponent(0.5).domain([0, max]).range([0, 1]).clamp(true);
    return (v) => ramp(t(v));
  }, [max, theme]);

  const nodes = useMemo(() => {
    const ns = data.map((d) => ({ ...d, r: r(d.value) }));
    const sim = d3
      .forceSimulation(ns)
      .force("x", d3.forceX((d) => x(d.year)).strength(1))
      .force("y", d3.forceY((H - M.bottom + M.top) / 2).strength(0.06))
      .force("collide", d3.forceCollide((d) => d.r + 1.2).strength(0.9))
      .stop();
    for (let i = 0; i < 220; i += 1) sim.tick();
    return ns;
  }, [data, x, r, H]);

  const [hover, setHover] = useState(-1);

  const ext = d3.extent(data.length ? data.map((d) => d.year) : [2005, 2023]);
  const ticks = [];
  for (let y = Math.ceil(ext[0] / 2) * 2; y <= ext[1]; y += 2) ticks.push(y);

  if (!data.length)
    return <div ref={wrapRef} className="etl etl--empty" />;

  return (
    <div ref={wrapRef} className="etl">
      <svg
        className="etl__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        onMouseLeave={() => setHover(-1)}
      >
        <line
          className="etl__axis"
          x1={M.left}
          x2={W - M.right}
          y1={H - M.bottom}
          y2={H - M.bottom}
        />
        {ticks.map((tk) => (
          <text
            key={tk}
            className="etl__tick"
            x={x(tk)}
            y={H - M.bottom + 20}
            textAnchor="middle"
          >
            {tk}
          </text>
        ))}

        {nodes.map((n, i) => (
          <circle
            key={`${n.area}-${n.year}`}
            className={`etl__dot ${hover === i ? "is-hover" : ""}`}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={color(n.value)}
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {hover >= 0 && nodes[hover] && (
          <g
            className="etl__tip"
            transform={`translate(${nodes[hover].x},${nodes[hover].y - nodes[hover].r - 8})`}
          >
            <text className="etl__tip-main" textAnchor="middle">
              {nodes[hover].name} · {nodes[hover].year}
            </text>
            <text className="etl__tip-sub" y={16} textAnchor="middle">
              {format(nodes[hover].value)} {unit}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
