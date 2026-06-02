// src/components/ParadoxScatter/ParadoxScatter.jsx
// ============================================================
// Graphe signature de l'Acte 1 — le paradoxe en une image.
// x = ce qu'un territoire EMET (echelle log) ; y = ce qu'il SUBIT.
//
//  • SELECTEUR d'axe vertical : l'utilisateur choisit la donnee subie
//    (montee des eaux, temperature, population touchee...) ;
//  • DEFAUT INTELLIGENT : on ouvre sur la metrique qui VARIE le plus entre
//    territoires (coefficient de variation) -> evite le nuage "tout a plat" ;
//    note affichee si la metrique choisie varie trop peu ;
//  • couleur SEMANTIQUE (faible emetteur = vert, fort = rouge) ;
//  • territoire le PLUS paradoxal mis en avant (anneau + etiquette) ;
//  • etiquettes anti-collision, quadrant ombre, medianes, tooltip ;
//  • axe X log avec ticks nettoyes (plus de chevauchement).
// Aucun style inline. Couleurs via SCSS/tokens. Chrome i18n via scatterLabels ;
// les libelles de metriques/unites viennent du parent.
//
// Props :
//   metrics : [{ id, label, unit, rows:[{area,name,x,y}] }]  (prefere)
//   rows, yLabel, yUnit                                       (repli 1 metrique)
//   xLabel, xUnit, xLog, medianX, labels {empty, hint, paradox}
// ============================================================

import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import { useLang } from "../../store/context/langContext";
import scatterLabels from "../../i18n/scatterLabels";
import "./ParadoxScatter.scss";

const VW = 880;
const VH = 520;
const M = { top: 30, right: 28, bottom: 58, left: 66 };
const LABEL_H = 14;
const charW = 6.3;
const LOW_CV = 0.15;
const LOG_TICKS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];

function collides(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

function paradoxScore(r, xExtent, yMax) {
  const lo = Math.log10(xExtent[0] || 0.1);
  const hi = Math.log10(xExtent[1] || 1);
  const xN = (Math.log10(r.x) - lo) / ((hi - lo) || 1);
  return r.y / yMax + (1 - xN);
}

function validRows(rows) {
  return (rows || []).filter(
    (r) => Number.isFinite(r.x) && Number.isFinite(r.y) && r.x > 0,
  );
}

function cvOf(rows) {
  const ys = validRows(rows).map((r) => r.y);
  if (ys.length < 2) return 0;
  const mean = d3.mean(ys);
  const sd = d3.deviation(ys) || 0;
  return mean ? sd / Math.abs(mean) : 0;
}

export default function ParadoxScatter({
  metrics = [],
  rows = [],
  yLabel,
  yUnit,
  xLabel,
  xUnit,
  xLog = true,
  medianX = null,
  labels = {},
}) {
  const { lang } = useLang();
  const L = scatterLabels[lang] || scatterLabels.fr;
  const [hover, setHover] = useState(null);
  const [sel, setSel] = useState(null);

  const innerW = VW - M.left - M.right;
  const innerH = VH - M.top - M.bottom;

  const metricList = useMemo(() => {
    if (Array.isArray(metrics) && metrics.length) return metrics;
    if (Array.isArray(rows) && rows.length) {
      return [{ id: "y", label: yLabel, unit: yUnit, rows }];
    }
    return [];
  }, [metrics, rows, yLabel, yUnit]);

  const usable = useMemo(
    () => metricList.filter((m) => validRows(m.rows).length >= 3),
    [metricList],
  );

  const defaultId = useMemo(() => {
    let best = null;
    usable.forEach((m) => {
      const cv = cvOf(m.rows);
      if (!best || cv > best.cv) best = { id: m.id, cv };
    });
    return best ? best.id : usable[0] ? usable[0].id : null;
  }, [usable]);

  const activeId = sel != null ? sel : defaultId;
  const metric = useMemo(
    () => usable.find((m) => m.id === activeId) || usable[0] || null,
    [usable, activeId],
  );

  const valid = useMemo(() => (metric ? validRows(metric.rows) : []), [metric]);

  const x = useMemo(() => {
    const xs = valid.map((r) => r.x);
    const lo = d3.min(xs) ?? 0.1;
    const hi = d3.max(xs) ?? 1;
    const s = xLog
      ? d3.scaleLog().domain([Math.max(0.05, lo * 0.8), hi * 1.15])
      : d3.scaleLinear().domain([0, hi * 1.1]);
    return s.range([M.left, M.left + innerW]).clamp(true);
  }, [valid, xLog, innerW]);

  const y = useMemo(() => {
    const hi = d3.max(valid, (r) => r.y) ?? 1;
    return d3.scaleLinear().domain([0, hi * 1.12]).range([M.top + innerH, M.top]).nice();
  }, [valid, innerH]);

  const medY = useMemo(() => d3.median(valid, (r) => r.y) ?? null, [valid]);

  const paradoxArea = useMemo(() => {
    if (!valid.length) return null;
    const xExtent = d3.extent(valid, (r) => r.x);
    const yMax = d3.max(valid, (r) => r.y) || 1;
    const top = [...valid].sort(
      (a, b) => paradoxScore(b, xExtent, yMax) - paradoxScore(a, xExtent, yMax),
    )[0];
    return top ? top.area : null;
  }, [valid]);

  const placed = useMemo(() => {
    if (!valid.length) return {};
    const xExtent = d3.extent(valid, (r) => r.x);
    const yMax = d3.max(valid, (r) => r.y) || 1;
    const order = [...valid].sort(
      (a, b) => paradoxScore(b, xExtent, yMax) - paradoxScore(a, xExtent, yMax),
    );
    const boxes = [];
    const out = {};
    order.forEach((r) => {
      const cx = x(r.x);
      const cy = y(r.y);
      const w = r.area.length * charW + 6;
      const candidates = [
        { side: "r", x: cx + 10, y: cy - LABEL_H / 2 },
        { side: "l", x: cx - 10 - w, y: cy - LABEL_H / 2 },
      ];
      for (const c of candidates) {
        const box = { x: c.x, y: c.y, w, h: LABEL_H };
        const inBounds =
          box.x >= M.left - 2 &&
          box.x + box.w <= M.left + innerW + 2 &&
          box.y >= M.top &&
          box.y + box.h <= M.top + innerH;
        if (inBounds && !boxes.some((b) => collides(box, b))) {
          boxes.push(box);
          out[r.area] = c.side;
          break;
        }
      }
    });
    return out;
  }, [valid, x, y, innerW, innerH]);

  if (!metric || valid.length < 3) {
    return <div className="ps ps--empty">{labels.empty}</div>;
  }

  const yLab = metric.label;
  const yU = metric.unit;
  const lowVar = cvOf(metric.rows) < LOW_CV;
  const xFmt = d3.format("~g");
  const xTickVals = xLog
    ? LOG_TICKS.filter((v) => v >= x.domain()[0] && v <= x.domain()[1])
    : x.ticks(6);
  const yTicks = y.ticks(5);
  const medX = medianX != null ? x(Math.max(medianX, x.domain()[0])) : null;
  const medYpx = medY != null ? y(medY) : null;

  return (
    <figure className="ps">
      <div className="ps__controls">
        <p className="ps__story">{L.story}</p>
        {usable.length > 1 && (
          <div className="ps__pick" role="group" aria-label={L.axisPick}>
            <span className="ps__pick-lbl">{L.axisPick}</span>
            {usable.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`ps__pill ${m.id === activeId ? "is-active" : ""}`}
                aria-pressed={m.id === activeId}
                onClick={() => setSel(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <svg
        className="ps__svg"
        viewBox={`0 0 ${VW} ${VH}`}
        role="img"
        aria-label={`${xLabel} / ${yLab}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {medX != null && medYpx != null && (
          <g className="ps__quad">
            <rect x={M.left} y={M.top} width={medX - M.left} height={medYpx - M.top} />
            <text className="ps__quad-lbl" x={M.left + 10} y={M.top + 18}>{labels.paradox}</text>
          </g>
        )}

        {yTicks.map((t) => (
          <g key={`y${t}`} className="ps__grid">
            <line x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} />
            <text className="ps__tick" x={M.left - 10} y={y(t)} dy="0.32em">{t}</text>
          </g>
        ))}
        {xTickVals.map((t) => (
          <text key={`x${t}`} className="ps__tick ps__tick--x" x={x(t)} y={M.top + innerH + 22}>{xFmt(t)}</text>
        ))}

        {medX != null && (
          <g className="ps__median">
            <line x1={medX} x2={medX} y1={M.top} y2={M.top + innerH} />
            <text className="ps__median-lbl" x={medX} y={M.top - 8}>{labels.hint}</text>
          </g>
        )}
        {medYpx != null && (
          <line className="ps__median-h" x1={M.left} x2={M.left + innerW} y1={medYpx} y2={medYpx} />
        )}

        <line className="ps__axis" x1={M.left} x2={M.left + innerW} y1={M.top + innerH} y2={M.top + innerH} />
        <line className="ps__axis" x1={M.left} x2={M.left} y1={M.top} y2={M.top + innerH} />
        <text className="ps__axlabel" x={M.left + innerW} y={M.top + innerH + 46} textAnchor="end">{xLabel} ({xUnit}) {"\u2192"}</text>
        <text className="ps__axlabel" transform={`translate(18 ${M.top}) rotate(-90)`} textAnchor="end">{"\u2190"} {yLab} ({yU})</text>

        {valid.map((r) => {
          const low = medianX != null && r.x <= medianX;
          const isParadox = r.area === paradoxArea;
          const on = hover === r.area;
          const dim = hover && !on;
          const side = placed[r.area];
          const showLabel = on || isParadox || Boolean(side);
          const cx = x(r.x);
          const cy = y(r.y);
          const right = on ? side !== "l" : side === "r";
          const cls = [
            "ps__pt",
            low ? "is-low" : "is-high",
            isParadox ? "is-paradox" : "",
            on ? "is-on" : "",
            dim ? "is-dim" : "",
          ].join(" ");
          return (
            <g
              key={r.area}
              className={cls}
              onMouseEnter={() => setHover(r.area)}
              onMouseLeave={() => setHover(null)}
            >
              {isParadox && <circle className="ps__ring" cx={cx} cy={cy} r={13} />}
              <circle className="ps__dot" cx={cx} cy={cy} r={on || isParadox ? 8.5 : 6} />
              {showLabel && (
                <text
                  className="ps__code"
                  x={right ? cx + 9 : cx - 9}
                  y={cy}
                  dy="0.32em"
                  textAnchor={right ? "start" : "end"}
                >
                  {r.area}
                </text>
              )}
            </g>
          );
        })}

        {hover &&
          (() => {
            const r = valid.find((d) => d.area === hover);
            if (!r) return null;
            const w = 200;
            const tx = Math.min(Math.max(x(r.x) + 12, M.left), VW - w - 6);
            const ty = Math.min(Math.max(y(r.y) - 52, M.top + 2), M.top + innerH - 48);
            return (
              <g className="ps__tip">
                <rect x={tx} y={ty} width={w} height={44} rx="6" />
                <text className="ps__tip-name" x={tx + 12} y={ty + 18}>{r.name}</text>
                <text className="ps__tip-val" x={tx + 12} y={ty + 34}>{r.x} {xUnit} {"\u00b7"} {r.y} {yU}</text>
              </g>
            );
          })()}
      </svg>

      {lowVar && <p className="ps__note">{L.lowVariance}</p>}
    </figure>
  );
}