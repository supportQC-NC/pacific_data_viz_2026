// src/components/EscaleTransition/EscaleTransition.jsx
// ============================================================
// TRANSITION D'ESCALE — « La traversée » (v3, voyage en pirogue).
// On NAVIGUE (pas de saut spatial) : le va'a glisse sur la mer nocturne, le
// VRAI ciel étoilé (StarfieldCanvas, identique à la couverture) défile en
// parallaxe, le sillage s'allonge, puis l'AUBE se lève à l'horizon dans la
// couleur de l'escale et le carton-titre se forme.
//
// Accent par escale : CSS var --escale-accent. prefers-reduced-motion : pas
// de navigation animée, l'aube + le carton apparaissent directement.
//
// Props : kicker, title, subtitle, accent, enterLabel, onEnter, active.
// ============================================================

import React, { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import StarfieldCanvas from "../StarfieldCanvas/StarfieldCanvas";
import "./EscaleTransition.scss";

export default function EscaleTransition({
  kicker = "Escale I",
  title = "La Fièvre de l’Océan",
  subtitle = "",
  accent = "#5ec8d8",
  enterLabel = "Entrer",
  onEnter,
  active = true,
  // Décor de la traversée :
  //   "sea"  (défaut) · haute mer, la pirogue passe et poursuit sa route
  //   "land"           · ATTERRAGE : une île entre par la droite, la pirogue
  //                      ralentit et vient s'y ranger (le sillage s'éteint).
  // La coque du Récit dérive cette valeur du MOUVEMENT narratif de l'acte
  // (journeyContext) : les escales « Ressources & vivant » et « L'humain en
  // première ligne » se jouent à terre.
  scene = "sea",
}) {
  const rootRef = useRef(null);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    if (!active) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;

    if (reduced) {
      gsap.set(root.querySelector(".etrans__dawn"), {
        clipPath: "inset(0% 0 0 0)",
      });
      gsap.set(root.querySelector(".etrans__voyage"), {
        opacity: 1,
        xPercent: 6,
      });
      gsap.set(root.querySelectorAll(".etrans__card > *"), {
        opacity: 1,
        y: 0,
      });
      return undefined;
    }

    const ctx = gsap.context(() => {
      gsap.set(".etrans__dawn", { clipPath: "inset(100% 0 0 0)" });
      gsap.set(".etrans__voyage", { xPercent: -34, scale: 0.82, opacity: 0 });
      gsap.set(".etrans__wake", { scaleX: 0.15, transformOrigin: "100% 50%" });

      const landing = scene === "land";
      // À l'atterrage la pirogue s'arrête plus tôt : elle vient se ranger le
      // long de l'île qui entre par la droite, au lieu de filer au large.
      const endX = landing ? 1 : 16;

      const tl = gsap.timeline();
      // 1) La pirogue entre et navigue d'ouest en est.
      tl.to(".etrans__voyage", { opacity: 1, duration: 0.5 }, 0)
        .to(
          ".etrans__voyage",
          {
            xPercent: endX,
            scale: 1.06,
            duration: 2.1,
            ease: landing ? "power2.out" : "power1.inOut",
          },
          0,
        )
        .to(
          ".etrans__wake",
          { scaleX: 1, duration: 1.4, ease: "power1.out" },
          0.3,
        )
        // 2) Le ciel étoilé défile (parallaxe) → sensation d'avancer.
        // Parallaxe du ciel : glissement VOLONTAIREMENT faible. Le canvas est
        // dimensionné en JS à la largeur du conteneur, donc tout décalage
        // découvre une bande sans étoiles sur le bord droit — 173 px à -12%,
        // mesuré à l'écran. À -3%, la sensation d'avancer subsiste et la
        // bande (~43 px) tombe sous la vignette.
        // Opacité remontée de 0.4 à 0.62 : à 0.4 le ciel paraissait vide,
        // alors que les étoiles sont le fil conducteur du voyage.
        .to(
          ".etrans__starfield",
          { xPercent: -3, opacity: 0.62, duration: 2.1, ease: "none" },
          0,
        )
        .to(".etrans__sea", { xPercent: -7, duration: 2.1, ease: "none" }, 0)
        // 3) L'aube se lève à l'horizon, dans la couleur de l'escale.
        .to(
          ".etrans__dawn",
          { clipPath: "inset(0% 0 0 0)", duration: 1.3, ease: "power2.inOut" },
          0.95,
        )
        .to(".etrans__sky", { opacity: 0.35, duration: 1.3 }, 0.95)
        // 4) Le carton-titre se forme.
        .from(
          ".etrans__card > *",
          {
            y: 32,
            opacity: 0,
            duration: 0.75,
            stagger: 0.12,
            ease: "power3.out",
          },
          1.75,
        )
        .from(
          ".etrans__rule",
          { scaleX: 0, duration: 0.6, ease: "power2.out" },
          1.85,
        );

      // 5) ATTERRAGE : l'île entre par la droite pendant la traversée, puis
      //    le sillage s'éteint — on arrive, on ne passe plus.
      if (landing) {
        gsap.set(".etrans__land", { xPercent: 46, opacity: 0 });
        tl.to(
          ".etrans__land",
          { xPercent: 0, opacity: 1, duration: 1.9, ease: "power1.out" },
          0.25,
        ).to(
          ".etrans__wake",
          { scaleX: 0.18, opacity: 0.3, duration: 0.8, ease: "power2.in" },
          1.5,
        );
      }
    }, rootRef);
    return () => ctx.revert();
  }, [active, reduced, scene]);

  if (!active) return null;

  return (
    <section
      className={`etrans ${scene === "land" ? "etrans--land" : ""}`}
      ref={rootRef}
      style={{ "--escale-accent": accent }}
      aria-label={`${kicker} — ${title}`}
    >
      <div className="etrans__sky" aria-hidden="true" />

      {/* le VRAI ciel étoilé (même composant que la couverture) */}
      <StarfieldCanvas className="etrans__starfield" />

      {/* l'aube qui se lève (derrière la mer et la pirogue) */}
      <div className="etrans__dawn" aria-hidden="true">
        <div className="etrans__glow" />
      </div>

      {/* L'ÎLE — uniquement à l'atterrage. Silhouette : relief, cocotiers,
          frange de récif. Derrière la mer (z-index), devant l'aube : la
          pirogue passe donc DEVANT le rivage, elle y accoste. */}
      {scene === "land" && (
        <div className="etrans__land" aria-hidden="true">
          <svg viewBox="0 0 520 300" preserveAspectRatio="xMidYMax meet">
            {/* relief */}
            <path
              className="etrans__land-hill"
              d="M60 230 Q 150 96 250 150 Q 320 60 400 150 Q 460 190 520 230 Z"
            />
            {/* frange de plage */}
            <path
              className="etrans__land-shore"
              d="M20 236 Q 180 208 300 232 Q 420 252 520 236 L520 300 L20 300 Z"
            />
            {/* cocotiers : tronc courbé + palmes */}
            <g className="etrans__land-palm">
              <path d="M150 232 Q 158 190 146 160" />
              <path d="M146 160 Q 122 146 106 156" />
              <path d="M146 160 Q 170 142 190 152" />
              <path d="M146 160 Q 138 138 148 122" />
            </g>
            <g className="etrans__land-palm">
              <path d="M348 234 Q 342 198 352 172" />
              <path d="M352 172 Q 330 158 316 168" />
              <path d="M352 172 Q 376 156 394 166" />
              <path d="M352 172 Q 356 150 348 136" />
            </g>
          </svg>
        </div>
      )}

      {/* la mer */}
      <div className="etrans__sea" aria-hidden="true">
        <svg viewBox="0 0 1440 220" preserveAspectRatio="none">
          <path
            className="etrans__wave etrans__wave--back"
            d="M0 90 Q 240 50 480 90 T 960 90 T 1440 90 V220 H0 Z"
          />
          <path
            className="etrans__wave etrans__wave--mid"
            d="M0 120 Q 240 85 480 120 T 960 120 T 1440 120 V220 H0 Z"
          />
          <path
            className="etrans__wave etrans__wave--front"
            d="M0 150 Q 240 120 480 150 T 960 150 T 1440 150 V220 H0 Z"
          />
        </svg>
      </div>

      {/* la pirogue qui traverse */}
      <div className="etrans__voyage" aria-hidden="true">
        <svg viewBox="0 0 260 200">
          <path className="etrans__wake" d="M8 174 Q 70 169 120 174" />
          <path className="etrans__wake" d="M22 184 Q 78 181 122 184" />
          <ellipse
            className="etrans__vshadow"
            cx="150"
            cy="186"
            rx="76"
            ry="6"
          />
          <path
            className="etrans__sail"
            d="M150 26 C 200 48 218 102 216 152 C 184 141 162 124 150 109 Z"
          />
          <path
            className="etrans__sail etrans__sail--back"
            d="M150 32 C 122 57 112 102 114 146 C 137 133 146 120 150 109 Z"
          />
          <line className="etrans__mast" x1="150" y1="24" x2="150" y2="166" />
          <path
            className="etrans__hull"
            d="M90 168 Q 150 193 210 168 Q 183 181 150 181 Q 117 181 90 168 Z"
          />
          <path className="etrans__ama" d="M86 191 Q 150 201 208 191" />
          <line className="etrans__iako" x1="121" y1="177" x2="115" y2="191" />
          <line className="etrans__iako" x1="179" y1="177" x2="185" y2="191" />
        </svg>
      </div>

      {/* le carton-titre */}
      <div className="etrans__card">
        <span className="etrans__kicker">{kicker}</span>
        <span className="etrans__rule" aria-hidden="true" />
        <h2 className="etrans__title">{title}</h2>
        {subtitle && <p className="etrans__sub">{subtitle}</p>}
        {onEnter && (
          <button type="button" className="etrans__enter" onClick={onEnter}>
            {enterLabel} <span aria-hidden="true">↓</span>
          </button>
        )}
      </div>
    </section>
  );
}
