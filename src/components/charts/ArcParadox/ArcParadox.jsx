// src/components/charts/ArcParadox/ArcParadox.jsx
// ============================================================
// L'ARC DU PARADOXE — visuel signature de la synthèse (SVG pur, sans d3).
//
// Un seul axe horizontal 0 → 100. Pour chaque territoire :
//   • un CERCLE CREUX à sa position de RESPONSABILITÉ (rang d'émissions) ;
//   • un ARC qui rejoint, sur le même axe, sa position de VULNÉRABILITÉ ;
//   • un DISQUE PLEIN au point d'arrivée (vulnérabilité).
// Un arc qui monte vers la droite (vuln > resp) = peu responsable mais très
// exposé → l'injustice climatique, colorée en corail (--c-warm). Sinon cyan
// (--c-accent). La longueur de l'arc encode l'ampleur de l'écart : plus c'est
// long et haut, plus le renversement est flagrant.
//
// Les étiquettes des écarts majeurs sont placées par un algorithme glouton
// anti-collision (on remonte chaque label tant qu'il en chevauche un autre).
//
// 100 % piloté par les données passées en props. Aucune chaîne en dur :
// tous les libellés viennent du parent (i18n via useLang côté Acte 11).
// ============================================================

import React, { useMemo, useState, useCallback } from "react";
import "./ArcParadox.scss";

// Repère interne fixe : le SVG est mis à l'échelle en CSS (width:100%).
const VB_W = 1000;
const VB_H = 480;
const M = { top: 64, right: 64, bottom: 74, left: 64 };
const Y0 = VB_H - M.bottom; // ligne de base
const PLOT_W = VB_W - M.left - M.right;
const MAX_ARC = Y0 - M.top; // hauteur d'arc maximale
const TICKS = [0, 25, 50, 75, 100];
const LABEL_H = 17; // hauteur d'une étiquette (anti-collision)

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const xOf = (v) => M.left + (clamp(v, 0, 100) / 100) * PLOT_W;
const r1 = (n) => Math.round(n * 10) / 10;

export default function ArcParadox({
  rows = [],
  respLabel = "",
  vulnLabel = "",
  lowLabel = "",
  highLabel = "",
  upLabel = "",
  downLabel = "",
  gapLabel = "",
  hintLabel = "",
  maxLabels = 5,
}) {
  const [hover, setHover] = useState(null);

  const bands = useMemo(() => {
    const valid = rows
      .filter((r) => Number.isFinite(r.resp) && Number.isFinite(r.vuln))
      .map((r) => ({ ...r, gap: r.vuln - r.resp }));

    // Les N écarts les plus marquants sont annotés (nom près du sommet).
    const labelled = new Set(
      [...valid]
        .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
        .slice(0, maxLabels)
        .map((r) => r.name),
    );

    // Ordre de tracé : petits écarts d'abord, gros écarts au-dessus.
    return [...valid]
      .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
      .map((r) => {
        const xa = xOf(r.resp);
        const xb = xOf(r.vuln);
        const span = Math.abs(xb - xa);
        const arcH = Math.max((span / PLOT_W) * MAX_ARC, 16);
        const k = (arcH * 4) / 3; // bezier cubique : sommet ≈ 3/4 de k
        const d = `M ${r1(xa)} ${Y0} C ${r1(xa)} ${r1(Y0 - k)} ${r1(xb)} ${r1(
          Y0 - k,
        )} ${r1(xb)} ${Y0}`;
        return {
          key: `${r.code || r.name}`,
          name: r.name,
          resp: r.resp,
          vuln: r.vuln,
          gap: r.gap,
          xa,
          xb,
          d,
          apexX: (xa + xb) / 2,
          apexY: Y0 - arcH,
          up: r.gap > 0,
          intensity: clamp(0.22 + (Math.abs(r.gap) / 100) * 0.78, 0.22, 0.95),
          label: labelled.has(r.name),
        };
      });
  }, [rows, maxLabels]);

  // Placement glouton des étiquettes : on les trie par X et on remonte
  // chaque label tant qu'il chevauche horizontalement un label déjà posé.
  const labels = useMemo(() => {
    const items = bands
      .filter((b) => b.label)
      .map((b) => ({
        key: b.key,
        name: b.name,
        x: b.apexX,
        baseY: b.apexY - 10,
        up: b.up,
        w: Math.max(b.name.length * 7.4, 28),
      }))
      .sort((a, b) => a.x - b.x);

    const placed = [];
    items.forEach((it) => {
      let y = it.baseY;
      let guard = 0;
      const hits = (yy) =>
        placed.some(
          (p) =>
            Math.abs(p.x - it.x) < (p.w + it.w) / 2 &&
            Math.abs(p.y - yy) < LABEL_H,
        );
      while (hits(y) && guard < 14) {
        y -= LABEL_H;
        guard += 1;
      }
      placed.push({ ...it, y: Math.max(y, 16) });
    });
    return placed;
  }, [bands]);

  const active = useMemo(
    () => bands.find((b) => b.name === hover) || null,
    [bands, hover],
  );

  const enter = useCallback((name) => setHover(name), []);
  const leave = useCallback(() => setHover(null), []);

  if (!bands.length) return null;

  return (
    <figure className="arcp">
      <svg
        className="arcp__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label={`${respLabel} → ${vulnLabel}`}
      >
        {/* axe de base + graduations */}
        <line
          className="arcp__axis"
          x1={M.left}
          y1={Y0}
          x2={VB_W - M.right}
          y2={Y0}
        />
        {TICKS.map((tk) => (
          <g key={tk}>
            <line
              className="arcp__tick"
              x1={xOf(tk)}
              y1={Y0}
              x2={xOf(tk)}
              y2={Y0 + 7}
            />
            <text
              className="arcp__ticklabel"
              x={xOf(tk)}
              y={Y0 + 24}
              textAnchor="middle"
            >
              {tk}
            </text>
          </g>
        ))}
        <text
          className="arcp__axisend"
          x={M.left}
          y={Y0 + 44}
          textAnchor="start"
        >
          {lowLabel}
        </text>
        <text
          className="arcp__axisend"
          x={VB_W - M.right}
          y={Y0 + 44}
          textAnchor="end"
        >
          {highLabel}
        </text>

        {/* arcs */}
        {bands.map((b) => {
          const cls = [
            "arcp__band",
            b.up ? "arcp__band--up" : "arcp__band--down",
            active && active.name === b.name ? "is-active" : "",
            active && active.name !== b.name ? "is-dim" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <g key={b.key} className={cls}>
              <path
                className="arcp__hit"
                d={b.d}
                onMouseEnter={() => enter(b.name)}
                onMouseLeave={leave}
                onFocus={() => enter(b.name)}
                onBlur={leave}
                tabIndex={0}
                role="button"
                aria-label={`${b.name} — ${respLabel} ${Math.round(
                  b.resp,
                )}, ${vulnLabel} ${Math.round(b.vuln)}`}
              />
              <path
                className="arcp__arc"
                d={b.d}
                style={{ "--i": b.intensity }}
              />
              <circle className="arcp__cap arcp__cap--resp" cx={b.xa} cy={Y0} r={5} />
              <circle className="arcp__cap arcp__cap--vuln" cx={b.xb} cy={Y0} r={5} />
              <title>{`${b.name} · ${respLabel} ${Math.round(
                b.resp,
              )} · ${vulnLabel} ${Math.round(b.vuln)} · ${gapLabel} ${
                b.gap > 0 ? "+" : ""
              }${Math.round(b.gap)}`}</title>
            </g>
          );
        })}

        {/* annotations des écarts majeurs (placées sans chevauchement) */}
        {labels.map((l) => (
          <text
            key={`lbl-${l.key}`}
            className={`arcp__label ${l.up ? "is-up" : "is-down"}`}
            x={l.x}
            y={l.y}
            textAnchor="middle"
          >
            {l.name}
          </text>
        ))}
      </svg>

      {/* lecture au survol */}
      <p className="arcp__readout" aria-live="polite">
        {active ? (
          <>
            <span className="arcp__readout-name">{active.name}</span>
            <span className="arcp__readout-sep">·</span>
            {respLabel} {Math.round(active.resp)}
            <span className="arcp__readout-sep">·</span>
            {vulnLabel} {Math.round(active.vuln)}
            <span
              className={`arcp__readout-gap ${active.up ? "is-up" : "is-down"}`}
            >
              {gapLabel} {active.gap > 0 ? "+" : ""}
              {Math.round(active.gap)}
            </span>
          </>
        ) : (
          <span className="arcp__readout-hint">{hintLabel}</span>
        )}
      </p>

      {/* légende */}
      <ul className="arcp__legend">
        <li className="arcp__leg-item">
          <span className="arcp__leg-mark arcp__leg-mark--resp" aria-hidden="true" />
          {respLabel}
        </li>
        <li className="arcp__leg-item">
          <span className="arcp__leg-mark arcp__leg-mark--vuln" aria-hidden="true" />
          {vulnLabel}
        </li>
        <li className="arcp__leg-item">
          <span className="arcp__leg-mark arcp__leg-mark--up" aria-hidden="true" />
          {upLabel}
        </li>
        <li className="arcp__leg-item">
          <span className="arcp__leg-mark arcp__leg-mark--down" aria-hidden="true" />
          {downLabel}
        </li>
      </ul>
    </figure>
  );
}