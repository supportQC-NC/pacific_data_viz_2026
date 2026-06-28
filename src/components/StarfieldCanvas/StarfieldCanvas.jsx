// src/components/StarfieldCanvas/StarfieldCanvas.jsx
// ============================================================
// CIEL ÉTOILÉ — canvas natif (v4). Pour le Prologue (« lire les étoiles »).
//  • Étoiles : profondeur, scintillement, halo sur les proches.
//  • CONSTELLATIONS : liens entre étoiles voisines (carte du ciel).
//  • LANTERNE DU NAVIGATEUR : au survol, le curseur allume les étoiles
//    proches et trace des fils vers elles — on « relève » un cap.
//  • Parallaxe lissée (lerp) par couche de profondeur.
//  • Étoiles filantes : traînée fuselée + tête lumineuse (halo).
//  • prefers-reduced-motion : rendu statique, aucune animation/interaction.
// Aucune dépendance. pointer-events:none → ne bloque pas l'UI.
// ============================================================

import React, { useEffect, useRef } from "react";

export default function StarfieldCanvas({
  density = 0.00016,
  maxStars = 150,
  linkDist = 116,
  lanternRadius = 150,
  className = "rprologue__starfield",
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let stars = [];
    let shooting = null;
    let t = 0;
    let raf = 0;

    // Pointeur (coords client) + parallaxe lissée.
    let cx = null;
    let cy = null;
    let inside = false;
    let pmx = 0;
    let pmy = 0;

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(maxStars, Math.round(w * h * density));
      stars = Array.from({ length: count }, () => {
        const depth = Math.random();
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.4 + depth * 1.5,
          baseA: 0.22 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
          spd: 0.5 + Math.random() * 1.1,
          depth,
          vx: (Math.random() - 0.5) * 0.04,
          sx: 0,
          sy: 0,
          boost: 0,
        };
      });
    }

    function drawStatic() {
      ctx.clearRect(0, 0, w, h);
      stars.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(244,244,235,${s.baseA})`;
        ctx.fill();
      });
    }

    function spawnShooting() {
      const startX = w * (0.12 + Math.random() * 0.62);
      const startY = h * (0.04 + Math.random() * 0.3);
      const ang = Math.PI * (0.12 + Math.random() * 0.12); // descend vers la droite
      const spd = 9 + Math.random() * 6;
      shooting = {
        x: startX,
        y: startY,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0,
        ttl: 46,
        trail: [],
      };
    }

    function frame() {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      // Pointeur en coords canvas + parallaxe cible lissée.
      const rect = canvas.getBoundingClientRect();
      let plx = null;
      let ply = null;
      if (inside && cx != null) {
        plx = cx - rect.left;
        ply = cy - rect.top;
      }
      const tmx = plx != null ? (plx - w / 2) / (w / 2) : 0;
      const tmy = ply != null ? (ply - h / 2) / (h / 2) : 0;
      pmx += (tmx - pmx) * 0.06;
      pmy += (tmy - pmy) * 0.06;

      // Positions écran (parallaxe) + reset boost.
      stars.forEach((s) => {
        s.x += s.vx;
        if (s.x < 0) s.x += w;
        else if (s.x > w) s.x -= w;
        s.sx = s.x + pmx * s.depth * 18;
        s.sy = s.y + pmy * s.depth * 11;
        s.boost = 0;
      });

      // Liens de constellation.
      for (let i = 0; i < stars.length; i += 1) {
        const a = stars[i];
        for (let j = i + 1; j < stars.length; j += 1) {
          const b = stars[j];
          const dx = a.sx - b.sx;
          const dy = a.sy - b.sy;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDist * linkDist) {
            const alpha = (1 - Math.sqrt(d2) / linkDist) * 0.16;
            ctx.strokeStyle = `rgba(150,196,220,${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
        }
      }

      // Lanterne du navigateur : fils du curseur vers les étoiles proches.
      if (plx != null) {
        const R = lanternRadius;
        stars.forEach((s) => {
          const dx = s.sx - plx;
          const dy = s.sy - ply;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            const k = 1 - Math.sqrt(d2) / R;
            s.boost = k;
            ctx.strokeStyle = `rgba(120,210,235,${k * 0.5})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(plx, ply);
            ctx.lineTo(s.sx, s.sy);
            ctx.stroke();
          }
        });
      }

      // Étoiles.
      stars.forEach((s) => {
        const tw = 0.62 + 0.38 * Math.sin(t * s.spd + s.phase);
        let a = s.baseA * tw;
        let r = s.r;
        if (s.boost) {
          a = Math.min(1, a + s.boost * 0.6);
          r = s.r * (1 + s.boost * 0.9);
        }
        if (s.depth > 0.72 || s.boost > 0.4) {
          ctx.beginPath();
          ctx.arc(s.sx, s.sy, r * 2.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(150,206,230,${a * 0.14})`;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(s.sx, s.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(244,244,235,${a})`;
        ctx.fill();
      });

      // Étoile filante.
      if (shooting) {
        shooting.life += 1;
        shooting.x += shooting.vx;
        shooting.y += shooting.vy;
        shooting.trail.push({ x: shooting.x, y: shooting.y });
        if (shooting.trail.length > 16) shooting.trail.shift();
        const fade = 1 - shooting.life / shooting.ttl;
        const n = shooting.trail.length;
        ctx.lineCap = "round";
        for (let i = 1; i < n; i += 1) {
          const p0 = shooting.trail[i - 1];
          const p1 = shooting.trail[i];
          const al = (i / n) * 0.9 * fade;
          ctx.strokeStyle = `rgba(255,255,255,${al})`;
          ctx.lineWidth = (i / n) * 2.4;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        ctx.save();
        ctx.shadowColor = "rgba(180,220,255,0.9)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(255,255,255,${0.95 * fade})`;
        ctx.beginPath();
        ctx.arc(shooting.x, shooting.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (
          shooting.life > shooting.ttl ||
          shooting.x > w + 40 ||
          shooting.y > h + 40
        ) {
          shooting = null;
        }
      } else if (Math.random() < 0.005) {
        spawnShooting();
      }

      raf = requestAnimationFrame(frame);
    }

    function onMove(e) {
      cx = e.clientX;
      cy = e.clientY;
      inside = true;
    }
    function onLeave() {
      inside = false;
    }

    build();
    if (reduced) {
      drawStatic();
    } else {
      raf = requestAnimationFrame(frame);
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("mouseleave", onLeave);
      window.addEventListener("blur", onLeave);
    }
    const onResize = () => {
      build();
      if (reduced) drawStatic();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [density, maxStars, linkDist, lanternRadius]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
