// src/components/charts/Treemap/Treemap.jsx
// ============================================================
// TREEMAP squarifié (React Graph Gallery) en SVG pur, sans d3.
// « Le portefeuille agricole du Pacifique » : une tuile par produit.
//   • TAILLE = ubiquité (nombre de territoires qui le cultivent) — mesure
//     sans unité, donc honnête (on n'additionne pas des rendements
//     d'unités différentes) ;
//   • COULEUR = nature (vert = culture, corail = bétail) ;
//   • INTENSITÉ = rendement médian (normalisé par rang dans sa catégorie).
//
// Algorithme squarify (Bruls et al.) : les tuiles tendent vers le carré,
// bien plus lisible que le slice-and-dice. Survol → libellé, nature,
// nb de territoires, rendement. Libellés via props (i18n). Tokens du thème.
// ============================================================

import React, { useMemo, useState, useCallback } from "react";
import "./Treemap.scss";

const VB_W = 1000;
const VB_H = 520;
const PAD = 2;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const r1 = (n) => Math.round(n * 10) / 10;
const fmt = (n) =>
  Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : r1(n).toLocaleString();

// ---- squarified treemap -------------------------------------------------
function worst(row, side) {
  const sum = row.reduce((s, d) => s + d.area, 0);
  const maxA = Math.max(...row.map((d) => d.area));
  const minA = Math.min(...row.map((d) => d.area));
  const s2 = sum * sum;
  const w2 = side * side;
  return Math.max((w2 * maxA) / s2, s2 / (w2 * minA));
}
function layoutRow(row, rect, out) {
  const sum = row.reduce((s, d) => s + d.area, 0);
  if (rect.w >= rect.h) {
    const rw = sum / rect.h;
    let yy = rect.y;
    row.forEach((d) => {
      const hh = d.area / rw;
      out.push({ ...d, x: rect.x, y: yy, w: rw, h: hh });
      yy += hh;
    });
  } else {
    const rh = sum / rect.w;
    let xx = rect.x;
    row.forEach((d) => {
      const ww = d.area / rh;
      out.push({ ...d, x: xx, y: rect.y, w: ww, h: rh });
      xx += ww;
    });
  }
}
function squarify(data, x, y, w, h) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const scale = (w * h) / total;
  const items = data.map((d) => ({ ...d, area: d.value * scale }));
  const out = [];
  let rect = { x, y, w, h };
  let i = 0;
  while (i < items.length) {
    let row = [items[i]];
    let next = i + 1;
    let side = Math.min(rect.w, rect.h);
    while (next < items.length && side > 0) {
      const withNext = row.concat(items[next]);
      if (worst(row, side) >= worst(withNext, side)) {
        row = withNext;
        next += 1;
      } else break;
    }
    layoutRow(row, rect, out);
    const rowArea = row.reduce((s, d) => s + d.area, 0);
    if (rect.w >= rect.h) {
      const rw = rowArea / rect.h;
      rect = { x: rect.x + rw, y: rect.y, w: rect.w - rw, h: rect.h };
    } else {
      const rh = rowArea / rect.w;
      rect = { x: rect.x, y: rect.y + rh, w: rect.w, h: rect.h - rh };
    }
    side = Math.min(rect.w, rect.h);
    i = next;
  }
  return out;
}
// ------------------------------------------------------------------------

export default function Treemap({
  items = [],
  cropLabel = "",
  stockLabel = "",
  sizeLabel = "",
  yieldLabel = "",
  hintLabel = "",
}) {
  const [hover, setHover] = useState(null);

  const tiles = useMemo(() => {
    const data = [...items]
      .filter((d) => Number.isFinite(d.value) && d.value > 0)
      .sort((a, b) => b.value - a.value);
    if (!data.length) return [];
    return squarify(data, 0, 0, VB_W, VB_H).map((t) => ({
      ...t,
      fillOpacity: clamp(0.42 + (t.intensity ?? 0.5) * 0.5, 0.42, 0.94),
    }));
  }, [items]);

  const active = useMemo(
    () => tiles.find((t) => t.code === hover) || null,
    [tiles, hover],
  );
  const enter = useCallback((code) => setHover(code), []);
  const leave = useCallback(() => setHover(null), []);

  if (!tiles.length) return null;

  return (
    <figure className="tree">
      <svg
        className="tree__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={`${cropLabel} / ${stockLabel}`}
        preserveAspectRatio="none"
      >
        {tiles.map((t) => {
          const innerW = Math.max(0, t.w - PAD * 2);
          const innerH = Math.max(0, t.h - PAD * 2);
          const showLabel = innerW > 64 && innerH > 26;
          const maxChars = Math.floor(innerW / 7.6);
          const label =
            t.label.length > maxChars
              ? `${t.label.slice(0, Math.max(1, maxChars - 1))}…`
              : t.label;
          const cls = [
            "tree__tile",
            t.kind === "livestock" ? "is-stock" : "is-crop",
            active && active.code === t.code ? "is-active" : "",
            active && active.code !== t.code ? "is-dim" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <g key={t.code}>
              <rect
                className={cls}
                x={t.x + PAD}
                y={t.y + PAD}
                width={innerW}
                height={innerH}
                rx={3}
                style={{ "--fo": t.fillOpacity }}
                onMouseEnter={() => enter(t.code)}
                onMouseLeave={leave}
                onFocus={() => enter(t.code)}
                onBlur={leave}
                tabIndex={0}
                role="button"
                aria-label={`${t.label} — ${t.value} ${sizeLabel}`}
              />
              {showLabel ? (
                <text
                  className="tree__label"
                  x={t.x + PAD + 7}
                  y={t.y + PAD + 18}
                >
                  {label}
                </text>
              ) : null}
              {showLabel && innerH > 44 ? (
                <text
                  className="tree__sub"
                  x={t.x + PAD + 7}
                  y={t.y + PAD + 36}
                >
                  {t.value}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* lecture */}
      <p className="tree__readout" aria-live="polite">
        {active ? (
          <>
            <span
              className={`tree__readout-dot ${active.kind === "livestock" ? "is-stock" : "is-crop"}`}
            />
            <span className="tree__readout-name">{active.label}</span>
            <span className="tree__readout-sep">·</span>
            {active.value} {sizeLabel}
            {Number.isFinite(active.yield) ? (
              <span className="tree__readout-y">
                · {yieldLabel} {fmt(active.yield)} {active.unit || ""}
              </span>
            ) : null}
          </>
        ) : (
          <span className="tree__readout-hint">{hintLabel}</span>
        )}
      </p>

      {/* légende */}
      <ul className="tree__legend">
        <li className="tree__leg-item">
          <span className="tree__leg-dot is-crop" aria-hidden="true" />
          {cropLabel}
        </li>
        <li className="tree__leg-item">
          <span className="tree__leg-dot is-stock" aria-hidden="true" />
          {stockLabel}
        </li>
        <li className="tree__leg-item tree__leg-item--size">{sizeLabel}</li>
      </ul>
    </figure>
  );
}