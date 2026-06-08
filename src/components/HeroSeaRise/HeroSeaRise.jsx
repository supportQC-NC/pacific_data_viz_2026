// src/components/HeroSeaRise/HeroSeaRise.jsx
// ============================================================
// Hero : marée qui MONTE au scroll (montée des eaux), purement visuelle.
// Rendu CANVAS : plusieurs ondes sinusoïdales superposées, animées en
// requestAnimationFrame. Surface d'eau continue, SANS couture, pleine
// largeur en permanence, mouvement organique (digne d'une vraie houle).
//   • hauteur d'eau pilotée par le scroll (--rise interne) ;
//   • 3 couches (profondeur) + liseré de crête couleur accent ;
//   • couleurs lues depuis les tokens CSS → suit le thème light/dark ;
//   • figé proprement si prefers-reduced-motion (l'eau monte encore au scroll).
// ============================================================

import React, { useEffect, useRef } from "react";
import "./HeroSeaRise.scss";

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Couches d'ondes (de l'arrière vers l'avant) : amplitude px, longueur d'onde
// px, vitesse, phase, opacité, décalage vertical px.
const LAYERS = [
  { amp: 12, len: 620, spd: 0.00040, ph: 0.0, alpha: 0.20, off: -8 },
  { amp: 16, len: 380, spd: -0.00064, ph: 2.1, alpha: 0.34, off: 1 },
  { amp: 10, len: 240, spd: 0.00096, ph: 4.2, alpha: 0.48, off: 8 },
];

export default function HeroSeaRise() {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const riseRef = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return undefined;
    const ctx = canvas.getContext("2d");

    let W = 0;
    let H = 0;
    let dpr = 1;
    let raf = 0;
    const colors = { deep: "#0090c8", accent: "#00e6ff" };

    const readColors = () => {
      const cs = getComputedStyle(root);
      const d = cs.getPropertyValue("--c-accent-deep").trim();
      const a = cs.getPropertyValue("--c-accent").trim();
      if (d) colors.deep = d;
      if (a) colors.accent = a;
    };

    const resize = () => {
      const r = root.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const waveY = (L, x, surface, time) =>
      surface + L.off + L.amp * Math.sin((x / L.len) * Math.PI * 2 + L.ph + time * L.spd);

    const render = (time) => {
      const t = REDUCED ? 0 : time;
      // Niveau en cloche : 0 -> pic au centre (mi-scroll) -> redescend.
      const level = 0.11 + 0.45 * Math.sin(riseRef.current * Math.PI);
      const surface = H * (1 - level);
      ctx.clearRect(0, 0, W, H);

      LAYERS.forEach((L) => {
        ctx.beginPath();
        ctx.moveTo(0, waveY(L, 0, surface, t));
        for (let x = 6; x <= W; x += 6) ctx.lineTo(x, waveY(L, x, surface, t));
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, surface - 20, 0, H);
        g.addColorStop(0, colors.deep);
        g.addColorStop(1, colors.deep);
        ctx.globalAlpha = L.alpha;
        ctx.fillStyle = g;
        ctx.fill();
      });

      // Crête (écume) sur la couche de devant.
      const F = LAYERS[LAYERS.length - 1];
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.accent;
      ctx.beginPath();
      ctx.moveTo(0, waveY(F, 0, surface, t));
      for (let x = 6; x <= W; x += 6) ctx.lineTo(x, waveY(F, x, surface, t));
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const loop = (time) => {
      render(time);
      raf = requestAnimationFrame(loop);
    };

    // scroll → niveau de l'eau
    let sraf = 0;
    const onScroll = () => {
      if (sraf) return;
      sraf = requestAnimationFrame(() => {
        sraf = 0;
        const hero = root.closest(".home__hero") || root.parentElement;
        const h = hero ? hero.offsetHeight : window.innerHeight;
        riseRef.current = Math.min(1, Math.max(0, window.scrollY / (h || 1)));
        if (REDUCED) render(0);
      });
    };

    readColors();
    resize();
    onScroll();
    render(0);

    const ro = new ResizeObserver(() => { resize(); if (REDUCED) render(0); });
    ro.observe(root);
    const mo = new MutationObserver(readColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-theme", "class"] });
    window.addEventListener("scroll", onScroll, { passive: true });

    if (!REDUCED) raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (sraf) cancelAnimationFrame(sraf);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <div className="herosea" ref={rootRef} aria-hidden="true">
      <canvas className="herosea__canvas" ref={canvasRef} />
    </div>
  );
}