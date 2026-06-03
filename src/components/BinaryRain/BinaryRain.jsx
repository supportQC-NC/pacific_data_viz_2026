// src/components/BinaryRain/BinaryRain.jsx
// ============================================================
// Pluie de chiffres binaires (0/1) sur <canvas> — métaphore « les
// données qui tombent ». Réutilisable : Loader (rapide) et LanguageGate
// (lente, en fond). Couleurs lues sur les tokens (charte, light/dark).
//
// Props :
//   • className : classe CSS de positionnement (aucun style inline)
//   • stepMs    : cadence de chute (grand = plus lent / plus doux)
//   • fontSize  : taille des glyphes en px
//   • fade      : opacité de la traînée (petit = traînées plus longues)
//
// Respecte prefers-reduced-motion (champ statique, sans animation).
// ============================================================

import React, { useEffect, useRef } from "react";

function hexToRgb(hex) {
  const h = (hex || "").trim().replace("#", "");
  if (h.length !== 6) return { r: 5, g: 8, b: 17 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export default function BinaryRain({
  className = "binrain",
  stepMs = 33,
  fontSize = 16,
  fade = 0.16,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue("--c-accent").trim() || "#8fa1ea";
    const warm = cs.getPropertyValue("--c-warm").trim() || "#e08a73";
    const bg = hexToRgb(cs.getPropertyValue("--c-bg").trim() || "#050811");

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cols = 0;
    let drops = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / fontSize);
      drops = Array.from({ length: cols }, () =>
        Math.floor((Math.random() * h) / fontSize),
      );
      ctx.font = `${fontSize}px "IBM Plex Mono", monospace`;
      ctx.textBaseline = "top";
    };

    const renderStep = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.fillStyle = `rgba(${bg.r}, ${bg.g}, ${bg.b}, ${fade})`;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < cols; i += 1) {
        const ch = Math.random() > 0.5 ? "1" : "0";
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.fillStyle = Math.random() > 0.94 ? warm : accent;
        ctx.globalAlpha = Math.random() * 0.5 + 0.45;
        ctx.fillText(ch, x, y);
        ctx.globalAlpha = 1;

        if (y > h && Math.random() > 0.975) drops[i] = 0;
        else drops[i] += 1;
      }
    };

    const tick = (ts) => {
      raf = window.requestAnimationFrame(tick);
      if (ts - last < stepMs) return;
      last = ts;
      renderStep();
    };

    resize();
    if (reduced) {
      const accentStr = accent;
      ctx.fillStyle = accentStr;
      ctx.globalAlpha = 0.28;
      for (let i = 0; i < cols; i += 1) {
        ctx.fillText(
          Math.random() > 0.5 ? "1" : "0",
          i * fontSize,
          drops[i] * fontSize,
        );
      }
      ctx.globalAlpha = 1;
    } else {
      raf = window.requestAnimationFrame(tick);
    }

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [stepMs, fontSize, fade]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}