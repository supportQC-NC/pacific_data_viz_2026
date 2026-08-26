// src/components/ShootingStar/ShootingStar.jsx
// ============================================================
// ÉTOILE FILANTE EN ARC — canvas dédié au hero de la Home.
//
// Elle entre en HAUT À GAUCHE, décrit un ARC DE CERCLE en descendant vers la
// droite, et s'éteint près de l'horizon : elle décolle, elle atterrit.
//
// Pourquoi un composant à part plutôt que de toucher aux canvas existants :
//  • `MilkyWayCanvas` doit rester intact (règle posée) ;
//  • `StarfieldCanvas` est partagé avec le Prologue et les 12 traversées —
//    y toucher affecterait tout le voyage.
// Ce canvas ne dessine QUE la filante : quelques dizaines de pixels par
// frame, et rien du tout entre deux passages.
//
// La trajectoire est une courbe de Bézier quadratique : le point de contrôle
// placé en haut à droite produit une descente en arc, jamais une diagonale
// droite. La traînée suit la courbe (on garde les positions précédentes), donc
// elle s'incurve elle aussi — c'est ce qui distingue une vraie filante d'un
// simple trait en biais.
//
// prefers-reduced-motion : rien n'est dessiné, rien n'est animé.
// ============================================================

import React, { useEffect, useRef } from "react";

export default function ShootingStar({
  // Fenêtre entre deux passages (ms). Rare, mais pas au point de ne jamais
  // en voir une pendant qu'on lit le titre.
  minDelay = 4200,
  maxDelay = 11000,
  duration = 1500, // durée d'une traversée
  tail = 26, // nombre de positions gardées pour la traînée
  className = "",
}) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    let raf = 0;
    let star = null;
    let nextAt = performance.now() + minDelay;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Départ en haut à gauche, arrivée en bas à droite, sommet de l'arc en
    // haut à droite : la filante monte d'abord légèrement, puis retombe.
    const spawn = () => {
      const x0 = -0.06 * w + Math.random() * 0.16 * w;
      const y0 = -0.04 * h + Math.random() * 0.14 * h;
      const x1 = (0.62 + Math.random() * 0.4) * w;
      const y1 = (0.58 + Math.random() * 0.24) * h;
      star = {
        x0,
        y0,
        x1,
        y1,
        // Point de contrôle nettement au-dessus de la corde → arc franc.
        cx: x0 + (x1 - x0) * 0.62,
        cy: y0 - h * (0.1 + Math.random() * 0.1),
        t0: performance.now(),
        pts: [],
      };
    };

    // Bézier quadratique.
    const at = (s, u) => {
      const v = 1 - u;
      return {
        x: v * v * s.x0 + 2 * v * u * s.cx + u * u * s.x1,
        y: v * v * s.y0 + 2 * v * u * s.cy + u * u * s.y1,
      };
    };

    const frame = (now) => {
      ctx.clearRect(0, 0, w, h);

      if (!star && now >= nextAt) spawn();

      if (star) {
        // Progression adoucie : accélère en sortant, ralentit en atterrissant.
        const raw = Math.min(1, (now - star.t0) / duration);
        const u = raw < 0.5 ? 2 * raw * raw : 1 - (-2 * raw + 2) ** 2 / 2;
        const pos = at(star, u);
        star.pts.push(pos);
        while (star.pts.length > tail) star.pts.shift();

        // Fondu d'entrée et de sortie : elle ne surgit ni ne disparaît net.
        const fade = Math.min(1, raw / 0.12) * Math.min(1, (1 - raw) / 0.28);

        // Traînée : segments dégressifs qui SUIVENT la courbe.
        ctx.lineCap = "round";
        for (let i = 1; i < star.pts.length; i += 1) {
          const k = i / star.pts.length; // 0 = queue, 1 = tête
          ctx.beginPath();
          ctx.moveTo(star.pts[i - 1].x, star.pts[i - 1].y);
          ctx.lineTo(star.pts[i].x, star.pts[i].y);
          ctx.lineWidth = 0.4 + k * 2.4;
          ctx.strokeStyle = `rgba(226,238,255,${0.5 * k * k * fade})`;
          ctx.stroke();
        }

        // Tête lumineuse + halo.
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = "rgba(180,220,255,0.95)";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.96 * fade})`;
        ctx.fill();
        ctx.restore();

        if (raw >= 1) {
          star = null;
          nextAt = now + minDelay + Math.random() * (maxDelay - minDelay);
        }
      }

      raf = requestAnimationFrame(frame);
    };

    resize();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [minDelay, maxDelay, duration, tail]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
