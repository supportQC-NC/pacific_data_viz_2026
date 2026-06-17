// src/components/GlassVisual/GlassVisual.jsx
// ============================================================
// LE VERRE D'EAU (exactement celui d'origine) extrait en composant réutilisable.
// Surface en VAGUE animée + bulles + méniscus lumineux + dégradé de profondeur
// + déficit inscrit dans le vide. Piloté par une seule prop `pct` (0..1) : le
// niveau monte/descend en douceur (GSAP). La vague tourne en rAF, en pause hors
// écran et coupée en prefers-reduced-motion. Tokens, zéro inline.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useLang } from "../../store/context/langContext";
import "./GlassVisual.scss";

const TOP = 54;
const BOT = 260;
const SPAN = BOT - TOP;
const WX0 = 28;
const WX1 = 212;
const WBOT = 280;
const STEP = 8;
const GAP_MIN_PX = 50;

const yForPct = (pct) => BOT - pct * SPAN;

export default function GlassVisual({ pct = 0, median = null }) {
  const { t } = useLang();
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rootRef = useRef(null);
  const waterRef = useRef(null);
  const surfaceRef = useRef(null);
  const deficitGroupRef = useRef(null);
  const deficitNumRef = useRef(null);
  const levelObj = useRef({ p: 0 });

  const bubbles = useMemo(
    () => [
      { x: 100, r: 2.8, speed: 0.26, off: 0.0 },
      { x: 132, r: 1.9, speed: 0.34, off: 0.35 },
      { x: 114, r: 3.3, speed: 0.2, off: 0.62 },
      { x: 150, r: 2.1, speed: 0.3, off: 0.18 },
      { x: 88, r: 1.7, speed: 0.4, off: 0.8 },
    ],
    [],
  );
  const bubbleRefs = useRef([]);

  const wavePath = useCallback((levelY, phase, close) => {
    const amp = 4;
    const amp2 = 2.4;
    let d = "";
    for (let x = WX0; x <= WX1; x += STEP) {
      const y =
        levelY +
        amp * Math.sin(x * 0.05 + phase * 1.6) +
        amp2 * Math.sin(x * 0.1 - phase * 1.1);
      d += `${d ? " L" : "M"}${x.toFixed(1)},${y.toFixed(2)}`;
    }
    if (close) d += ` L${WX1},${WBOT} L${WX0},${WBOT} Z`;
    return d;
  }, []);

  const draw = useCallback(
    (phase) => {
      const p = levelObj.current.p;
      const levelY = yForPct(p);
      if (waterRef.current)
        waterRef.current.setAttribute("d", wavePath(levelY, phase, true));
      if (surfaceRef.current)
        surfaceRef.current.setAttribute("d", wavePath(levelY, phase, false));

      const emptyPx = levelY - TOP;
      if (deficitGroupRef.current) {
        if (emptyPx < GAP_MIN_PX) {
          deficitGroupRef.current.setAttribute("opacity", "0");
        } else {
          const midY = (TOP + levelY) / 2;
          deficitGroupRef.current.setAttribute(
            "transform",
            `translate(120 ${midY.toFixed(1)})`,
          );
          const op = Math.min(1, (emptyPx - GAP_MIN_PX) / 26) * 0.96;
          deficitGroupRef.current.setAttribute("opacity", op.toFixed(3));
          if (deficitNumRef.current)
            deficitNumRef.current.textContent = String(100 - Math.round(p * 100));
        }
      }

      bubbleRefs.current.forEach((node, i) => {
        if (!node) return;
        const b = bubbles[i];
        if (reduced || p <= 0.02) {
          node.setAttribute("opacity", "0");
          return;
        }
        const span = BOT - levelY;
        const prog = (phase * b.speed + b.off) % 1;
        const cy = BOT - prog * span;
        node.setAttribute("cx", b.x.toFixed(1));
        node.setAttribute("cy", cy.toFixed(1));
        node.setAttribute("r", (b.r * (0.6 + 0.4 * (1 - prog))).toFixed(2));
        node.setAttribute("opacity", (0.5 * Math.sin(Math.PI * prog)).toFixed(3));
      });
    },
    [wavePath, bubbles, reduced],
  );

  // Niveau animé selon pct
  useEffect(() => {
    const target = Math.max(0, Math.min(1, pct));
    if (reduced) {
      levelObj.current.p = target;
      draw(0);
      return undefined;
    }
    const tw = gsap.to(levelObj.current, {
      p: target,
      duration: 1.15,
      ease: "power2.out",
    });
    return () => tw.kill();
  }, [pct, reduced, draw]);

  // Pause hors écran
  const [vis, setVis] = useState(true);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const o = new IntersectionObserver(
      (es) => es.forEach((e) => setVis(e.isIntersecting)),
      { threshold: 0 },
    );
    o.observe(el);
    return () => o.disconnect();
  }, []);

  // Boucle vague
  useEffect(() => {
    if (reduced) {
      draw(0);
      return undefined;
    }
    if (!vis) return undefined;
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
  }, [reduced, vis, draw]);

  const ticks = [0.25, 0.5, 0.75];
  const medianY = median != null ? yForPct(median) : null;

  return (
    <svg
      ref={rootRef}
      className="glassviz"
      viewBox="0 0 240 300"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="gv-inner">
          <path d="M42,52 L198,52 L182,250 Q180,260 170,260 L70,260 Q60,260 58,250 Z" />
        </clipPath>
        <linearGradient id="gv-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="glassviz__stop-top" />
          <stop offset="0.55" className="glassviz__stop-mid" />
          <stop offset="1" className="glassviz__stop-bot" />
        </linearGradient>
      </defs>

      <g clipPath="url(#gv-inner)">
        <rect className="glassviz__cavity" x="30" y="46" width="180" height="230" />

        {ticks.map((tk) => (
          <line
            key={tk}
            className="glassviz__tick"
            x1="46"
            x2="64"
            y1={yForPct(tk)}
            y2={yForPct(tk)}
          />
        ))}

        <path ref={waterRef} className="glassviz__water" fill="url(#gv-fill)" d="" />
        <path ref={surfaceRef} className="glassviz__surface" fill="none" d="" />

        {bubbles.map((b, i) => (
          <circle
            key={i}
            ref={(n) => {
              bubbleRefs.current[i] = n;
            }}
            className="glassviz__bubble"
            cx={b.x}
            cy={BOT}
            r={b.r}
            opacity="0"
          />
        ))}

        {medianY != null && (
          <line
            className="glassviz__median"
            x1="52"
            x2="188"
            y1={medianY}
            y2={medianY}
          />
        )}

        <g ref={deficitGroupRef} className="glassviz__deficit" opacity="0">
          <text
            ref={deficitNumRef}
            className="glassviz__deficit-num"
            x="0"
            y="0"
            textAnchor="middle"
          >
            0
          </text>
          <text className="glassviz__deficit-cap" x="0" y="18" textAnchor="middle">
            {t("home.water.gap_short")}
          </text>
        </g>
      </g>

      <path
        className="glassviz__glass"
        d="M34,46 L206,46 L188,258 Q186,270 174,270 L66,270 Q54,270 52,258 Z"
      />
      <ellipse className="glassviz__rim" cx="120" cy="46" rx="86" ry="9" />
    </svg>
  );
}