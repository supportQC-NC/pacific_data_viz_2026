// src/components/MilkyWayCanvas/MilkyWayCanvas.jsx
// ============================================================
// VOIE LACTÉE 3D — canvas natif, plein cadre (hauteur ET largeur).
//
// Ce n'est pas un dégradé : les étoiles existent en VOLUME (x, y, z) et sont
// projetées en perspective. La profondeur produit la parallaxe, la taille et
// l'éclat ; on dérive lentement le long de l'axe z, donc on « traverse » le
// nuage au lieu de regarder une image.
//
//  • Plan galactique : densité gaussienne autour d'une bande inclinée, comme
//    la vraie Voie lactée — dense au cœur, diffuse aux bords.
//  • Profondeur : z ∈ [zNear, zFar]. Plus une étoile est proche, plus elle est
//    grosse, lumineuse et rapide. Recyclée quand elle sort du champ.
//  • Nuages de poussière : poches sombres qui masquent la bande par endroits,
//    c'est ce qui donne le relief (sans elles, on lit un aplat).
//  • Teintes : bleutées au cœur, ambrées sur les étoiles proches.
//  • Parallaxe au pointeur, lissée.
//  • prefers-reduced-motion : une seule passe statique, aucune animation.
//
// Réservé au hero de la Home. `StarfieldCanvas` (Prologue, traversées) n'est
// pas modifié : les deux rôles sont différents et cohabitent.
// ============================================================

import React, { useEffect, useRef } from "react";

export default function MilkyWayCanvas({
  count = 1400, // étoiles en volume
  tilt = -0.42, // inclinaison du plan galactique (radians)
  spread = 0.17, // épaisseur de la bande (fraction de la diagonale)
  speed = 0.28, // vitesse de traversée
  // PLONGÉE : passe à true au moment d'entrer dans le voyage. Les étoiles
  // accélèrent et s'étirent en traînées — on fonce dans le ciel. La montée
  // en puissance est progressive (rampe interne), pas un saut brutal.
  warp = false,
  className = "",
}) {
  const ref = useRef(null);
  const warpRef = useRef(false);
  warpRef.current = warp;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    let stars = [];
    let dust = [];
    let raf = 0;
    const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
    const wRef = { v: 0 }; // intensité de plongée effective (0 → 1), lissée

    const Z_NEAR = 0.35;
    const Z_FAR = 3.2;

    // Une étoile : position dans le plan galactique, puis bruit perpendiculaire.
    const makeStar = (z) => {
      // u = position LE LONG de la bande, v = écart perpendiculaire.
      const u = Math.random() * 2 - 1;
      // Somme de deux tirages ⇒ distribution en cloche : dense au centre de
      // la bande, raréfiée sur les bords. C'est ce qui dessine la traînée.
      const v = ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 2;
      const cos = Math.cos(tilt);
      const sin = Math.sin(tilt);
      return {
        x: u * cos - v * spread * sin,
        y: u * sin + v * spread * cos,
        z: z == null ? Z_NEAR + Math.random() * (Z_FAR - Z_NEAR) : z,
        // Les étoiles du cœur sont plus bleues, quelques-unes tirent vers l'ambre.
        warm: Math.random() < 0.14,
        a: 0.25 + Math.random() * 0.75,
        tw: Math.random() * Math.PI * 2, // phase de scintillement
        tws: 0.6 + Math.random() * 1.4,
      };
    };

    // Nuages de poussière : ils CREUSENT la bande. Sans eux, aplat uniforme.
    const makeDust = () => {
      const u = Math.random() * 2 - 1;
      const v = (Math.random() - 0.5) * 1.2;
      const cos = Math.cos(tilt);
      const sin = Math.sin(tilt);
      return {
        x: u * cos - v * spread * sin,
        y: u * sin + v * spread * cos,
        z: Z_NEAR + Math.random() * (Z_FAR - Z_NEAR),
        r: 0.06 + Math.random() * 0.16,
        a: 0.18 + Math.random() * 0.3,
      };
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(count * Math.min(1.6, Math.max(0.5, (w * h) / (1440 * 900))));
      stars = Array.from({ length: n }, () => makeStar());
      dust = Array.from({ length: 26 }, makeDust);
    };

    // Projection perspective : le champ couvre TOUTE la surface, quel que
    // soit le ratio — d'où l'échelle sur la diagonale.
    const project = (s) => {
      const diag = Math.hypot(w, h);
      const k = 1 / s.z;
      return {
        px: w / 2 + s.x * diag * 0.62 * k + ptr.sx * (1.4 - s.z) * 26,
        py: h / 2 + s.y * diag * 0.62 * k + ptr.sy * (1.4 - s.z) * 18,
        k,
      };
    };

    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);

      // 1) Halo diffus de la bande : la lueur de fond, dessinée en premier.
      const diag = Math.hypot(w, h);
      const gx = w / 2 + Math.cos(tilt) * 0;
      const gy = h / 2;
      const grad = ctx.createLinearGradient(
        gx - Math.sin(tilt) * diag * 0.5,
        gy + Math.cos(tilt) * diag * 0.5,
        gx + Math.sin(tilt) * diag * 0.5,
        gy - Math.cos(tilt) * diag * 0.5,
      );
      grad.addColorStop(0, "rgba(120,150,215,0)");
      grad.addColorStop(0.38, "rgba(150,178,235,0.1)");
      grad.addColorStop(0.5, "rgba(216,231,255,0.19)");
      grad.addColorStop(0.62, "rgba(150,178,235,0.1)");
      grad.addColorStop(1, "rgba(120,150,215,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 2) Étoiles, des plus lointaines aux plus proches.
      ctx.globalCompositeOperation = "lighter";
      for (const s of stars) {
        const { px, py, k } = project(s);
        if (px < -60 || px > w + 60 || py < -60 || py > h + 60) continue;
        const depth = 1 - (s.z - Z_NEAR) / (Z_FAR - Z_NEAR); // 0 loin → 1 près
        const twinkle = reduced ? 1 : 0.72 + 0.28 * Math.sin(t * 0.0013 * s.tws + s.tw);
        const r = (0.35 + depth * 1.5) * Math.min(1.7, k);
        const a = s.a * (0.28 + depth * 0.72) * twinkle;

        // PLONGÉE : on trace la TRAÎNÉE entre la position précédente de
        // l'étoile (plus loin, donc plus près du centre) et sa position
        // actuelle. C'est la profondeur qui produit l'étirement — les
        // étoiles proches filent, les lointaines bougent à peine.
        if (wRef.v > 0.02) {
          const back = project({ ...s, z: s.z + 0.34 * wRef.v });
          ctx.beginPath();
          ctx.moveTo(back.px, back.py);
          ctx.lineTo(px, py);
          ctx.lineWidth = Math.max(0.6, r * 1.1);
          ctx.strokeStyle = s.warm
            ? `rgba(255,226,190,${a * 0.85 * wRef.v})`
            : `rgba(226,238,255,${a * 0.85 * wRef.v})`;
          ctx.lineCap = "round";
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = s.warm
          ? `rgba(255,226,190,${a})`
          : `rgba(226,238,255,${a})`;
        ctx.fill();
        // Halo sur les plus proches : c'est lui qui donne le relief.
        if (depth > 0.72) {
          ctx.beginPath();
          ctx.arc(px, py, r * 4.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(170,205,255,${a * 0.09})`;
          ctx.fill();
        }
      }

      // 3) Nuages de poussière PAR-DESSUS, en soustractif : ils masquent la
      //    bande par endroits et creusent la profondeur.
      ctx.globalCompositeOperation = "destination-out";
      for (const d of dust) {
        const { px, py, k } = project(d);
        const rr = d.r * diag * 0.5 * k;
        const g2 = ctx.createRadialGradient(px, py, 0, px, py, rr);
        g2.addColorStop(0, `rgba(0,0,0,${d.a})`);
        g2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g2;
        ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (t) => {
      // Rampe de plongée : on ne saute jamais d'un coup à pleine vitesse,
      // sinon l'accélération est perçue comme un glitch. Montée rapide,
      // retour plus lent.
      const target = warpRef.current ? 1 : 0;
      wRef.v += (target - wRef.v) * (target > wRef.v ? 0.045 : 0.02);

      // Dérive le long de z : on traverse le nuage. En plongée, jusqu'à
      // 14 fois plus vite.
      const boost = 1 + wRef.v * 13;
      for (const s of stars) {
        s.z -= 0.00028 * speed * 16 * boost;
        if (s.z <= Z_NEAR) Object.assign(s, makeStar(Z_FAR));
      }
      for (const d of dust) {
        d.z -= 0.00012 * speed * 16 * boost;
        if (d.z <= Z_NEAR) Object.assign(d, makeDust(), { z: Z_FAR });
      }
      ptr.sx += (ptr.x - ptr.sx) * 0.045;
      ptr.sy += (ptr.y - ptr.sy) * 0.045;
      draw(t);
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e) => {
      ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    resize();
    if (reduced) {
      draw(0);
    } else {
      window.addEventListener("pointermove", onMove, { passive: true });
      raf = requestAnimationFrame(frame);
    }
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0);
    });
    ro.observe(canvas);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      ro.disconnect();
    };
  }, [count, tilt, spread, speed]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
