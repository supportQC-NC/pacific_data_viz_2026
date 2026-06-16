// src/components/WaterGlass/WaterGlass.jsx
// ============================================================
// SECTION SIGNATURE — « Un verre d'eau » (Home).
// L'utilisateur choisit un territoire ; le VERRE se remplit (ou se vide)
// jusqu'à la PART de population disposant d'une eau potable GÉRÉE EN
// SÉCURITÉ (ODD 6.1.1, indicateur SH_H2O_SAFE, OMS/UNICEF JMP), via le
// dataset live `water` du Pacific Data Hub.
//
// Cadrage « acquis » : le niveau d'eau = ce qui EST acquis. Le vide au-dessus
// = ce qui manque encore. Une ligne pointillée marque la MÉDIANE du Pacifique
// pour situer chaque territoire dans l'ensemble.
//
// Aucune valeur inventée : on n'affiche que les territoires qui ONT une donnée
// (dernière année connue). Surface d'eau vivante (vague + bulles) pilotée par
// requestAnimationFrame en manipulant directement les attributs SVG (pas de
// re-render React par frame) ; remplissage animé par GSAP. prefers-reduced-
// motion respecté. Tokens de thème uniquement, FR/EN, zéro style inline.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import gsap from "gsap";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { useLang } from "../../store/context/langContext";
import { isPict, pictName } from "../../i18n/pictNames";
import flagUrl from "../../i18n/flagUrl";
import useInView from "../../hooks/UseInView";
import "./WaterGlass.scss";

/* ---- Géométrie du verre (repère SVG, viewBox 0 0 220 320) ---- */
const TOP = 50; // y du bord intérieur haut (eau pleine)
const BOT = 280; // y du fond intérieur (eau vide)
const WX0 = 44; // bornes x de l'eau (plus large que le verre : rognée par le clip)
const WX1 = 176;
const WBOT = 296; // fond du tracé d'eau
const STEP = 8; // pas d'échantillonnage de la vague

/* Médiane d'un tableau de nombres. */
function median(arr) {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/* Dernière valeur finie d'une série [{year,value}]. */
function lastFinite(serie) {
  for (let i = serie.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(serie[i].value)) return serie[i];
  }
  return null;
}

/* Remplace {clé} par une valeur dans une chaîne i18n. */
function fillTpl(str, map) {
  return Object.entries(map).reduce(
    (s, [k, val]) => s.split(`{${k}}`).join(String(val)),
    String(str),
  );
}

export default function WaterGlass() {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView] = useInView({ threshold: 0.25 });

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const water = useSelector(selectDataset("water"));

  useEffect(() => {
    dispatch(loadDataset("water"));
  }, [dispatch]);

  const status = water.status;
  const ready = status === "succeeded" && water.data;

  /* Territoires AYANT une donnée (dernière année connue), triés par nom. */
  const list = useMemo(() => {
    if (!ready) return [];
    return Object.entries(water.data.byArea)
      .filter(([code]) => isPict(code))
      .map(([code, serie]) => {
        const pt = lastFinite(serie);
        if (!pt) return null;
        return {
          code,
          name: pictName(code, lang),
          value: Math.max(0, Math.min(100, pt.value)),
          year: pt.year,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [ready, water.data, lang]);

  const byCode = useMemo(() => {
    const m = {};
    list.forEach((o) => {
      m[o.code] = o;
    });
    return m;
  }, [list]);

  const medianValue = useMemo(
    () => median(list.map((o) => o.value)),
    [list],
  );
  const extremes = useMemo(() => {
    if (!list.length) return null;
    let best = list[0];
    let least = list[0];
    list.forEach((o) => {
      if (o.value > best.value) best = o;
      if (o.value < least.value) least = o;
    });
    return { best, least };
  }, [list]);

  /* Sélection — défaut : Fidji si présent, sinon le premier disponible. */
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(byCode.FJ ? "FJ" : list[0].code);
    }
  }, [list, selected, byCode]);

  const sel = selected ? byCode[selected] : null;
  const selPct = sel ? sel.value / 100 : 0;

  /* ----------- Animation : eau vivante (vague + bulles) ----------- */
  const waterRef = useRef(null); // <path> corps de l'eau
  const surfaceRef = useRef(null); // <path> ligne de surface (méniscus)
  const numberRef = useRef(null); // <span> grand %
  const levelObj = useRef({ p: 0 }); // niveau courant (0..1), muté par GSAP
  const startedRef = useRef(false);

  const bubbles = useMemo(
    () => [
      { x: 92, r: 2.6, speed: 0.26, off: 0.0 },
      { x: 120, r: 1.8, speed: 0.34, off: 0.35 },
      { x: 104, r: 3.1, speed: 0.2, off: 0.62 },
      { x: 134, r: 2.0, speed: 0.3, off: 0.18 },
      { x: 80, r: 1.6, speed: 0.4, off: 0.8 },
    ],
    [],
  );
  const bubbleRefs = useRef([]);

  const wavePath = useCallback((levelY, phase, close) => {
    const amp = 3.6;
    const amp2 = 2.1;
    let d = "";
    for (let x = WX0; x <= WX1; x += STEP) {
      const y =
        levelY +
        amp * Math.sin(x * 0.06 + phase * 1.6) +
        amp2 * Math.sin(x * 0.11 - phase * 1.1);
      d += `${d ? " L" : "M"}${x.toFixed(1)},${y.toFixed(2)}`;
    }
    if (close) d += ` L${WX1},${WBOT} L${WX0},${WBOT} Z`;
    return d;
  }, []);

  const draw = useCallback(
    (phase) => {
      const p = levelObj.current.p;
      const levelY = BOT - p * (BOT - TOP);
      if (waterRef.current)
        waterRef.current.setAttribute("d", wavePath(levelY, phase, true));
      if (surfaceRef.current)
        surfaceRef.current.setAttribute("d", wavePath(levelY, phase, false));
      if (numberRef.current)
        numberRef.current.textContent = String(Math.round(p * 100));
      bubbleRefs.current.forEach((node, i) => {
        if (!node) return;
        const b = bubbles[i];
        if (reduced || p <= 0.02) {
          node.setAttribute("opacity", "0");
          return;
        }
        const span = BOT - levelY; // hauteur de la colonne d'eau
        const prog = (phase * b.speed + b.off) % 1; // 0 (fond) → 1 (surface)
        const cy = BOT - prog * span;
        node.setAttribute("cx", b.x.toFixed(1));
        node.setAttribute("cy", cy.toFixed(1));
        node.setAttribute("r", (b.r * (0.6 + 0.4 * (1 - prog))).toFixed(2));
        node.setAttribute(
          "opacity",
          (0.5 * Math.sin(Math.PI * prog)).toFixed(3),
        );
      });
    },
    [wavePath, bubbles, reduced],
  );

  /* Remplissage : GSAP mute levelObj ; la boucle rAF lit et redessine. */
  useEffect(() => {
    if (inView) startedRef.current = true;
    const target = startedRef.current ? selPct : 0;
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
  }, [inView, selPct, reduced, draw]);

  /* Boucle d'animation de la surface (désactivée si reduced motion). */
  useEffect(() => {
    if (reduced) return undefined;
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
  }, [reduced, draw]);

  /* Position de la médiane (statique, dépend du jeu de données). */
  const medianY =
    medianValue != null ? BOT - (medianValue / 100) * (BOT - TOP) : null;

  const loading = status === "loading" || status === "idle";
  const failed = status === "failed";
  const empty = ready && list.length === 0;

  const have = sel ? Math.round(sel.value) : 0;
  const gap = 100 - have;

  const svgLabel = sel
    ? fillTpl(t("home.water.aria"), {
        area: sel.name,
        n: have,
        year: sel.year,
      })
    : t("home.water.title");

  return (
    <section
      className="waterglass"
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="waterglass__inner container">
        <header className="waterglass__head">
          <p className="eyebrow waterglass__kicker">{t("home.water.kicker")}</p>
          <h2 className="waterglass__title">{t("home.water.title")}</h2>
          <p className="waterglass__lead">{t("home.water.lead")}</p>
        </header>

        {loading && (
          <p className="waterglass__state">{t("home.water.loading")}</p>
        )}
        {(failed || empty) && (
          <p className="waterglass__state waterglass__state--err">
            {t("home.water.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="waterglass__stage">
            {/* Colonne 1 — contrôles */}
            <div className="waterglass__controls">
              <label className="waterglass__field">
                <span className="waterglass__field-label">
                  {t("home.water.select_label")}
                </span>
                <span className="waterglass__select">
                  <img
                    className="waterglass__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="waterglass__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.water.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="waterglass__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="waterglass__chips">
                  <button
                    type="button"
                    className="waterglass__chip"
                    onClick={() => setSelected(extremes.best.code)}
                  >
                    {t("home.water.highest")}
                    <em>{Math.round(extremes.best.value)}%</em>
                  </button>
                  <button
                    type="button"
                    className="waterglass__chip"
                    onClick={() => setSelected(extremes.least.code)}
                  >
                    {t("home.water.lowest")}
                    <em>{Math.round(extremes.least.value)}%</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — le verre */}
            <figure className="waterglass__viz">
              <svg
                className="waterglass__svg"
                viewBox="0 0 220 320"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  <clipPath id="wg-inner">
                    <path d="M61,50 L159,50 L147,278 Q146,286 138,286 L82,286 Q74,286 73,278 Z" />
                  </clipPath>
                  <linearGradient id="wg-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" className="waterglass__stop-top" />
                    <stop offset="1" className="waterglass__stop-bot" />
                  </linearGradient>
                </defs>

                {/* Corps du verre (vide) */}
                <g clipPath="url(#wg-inner)">
                  <rect
                    className="waterglass__cavity"
                    x="40"
                    y="44"
                    width="140"
                    height="252"
                  />
                  {/* Eau */}
                  <path
                    ref={waterRef}
                    className="waterglass__water"
                    fill="url(#wg-fill)"
                    d=""
                  />
                  <path
                    ref={surfaceRef}
                    className="waterglass__surface"
                    fill="none"
                    d=""
                  />
                  {/* Bulles */}
                  {bubbles.map((b, i) => (
                    <circle
                      key={i}
                      ref={(n) => {
                        bubbleRefs.current[i] = n;
                      }}
                      className="waterglass__bubble"
                      cx={b.x}
                      cy={BOT}
                      r={b.r}
                      opacity="0"
                    />
                  ))}
                  {/* Médiane du Pacifique */}
                  {medianY != null && (
                    <line
                      className="waterglass__median"
                      x1="58"
                      x2="162"
                      y1={medianY}
                      y2={medianY}
                    />
                  )}
                </g>

                {/* Contour + ouverture du verre */}
                <path
                  className="waterglass__glass"
                  d="M54,44 L166,44 L152,282 Q150,294 138,294 L82,294 Q70,294 68,282 Z"
                />
                <ellipse
                  className="waterglass__rim"
                  cx="110"
                  cy="44"
                  rx="56"
                  ry="8"
                />
              </svg>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="waterglass__readout">
              <p className="waterglass__pct">
                <span ref={numberRef} className="waterglass__pct-num">
                  {have}
                </span>
                <span className="waterglass__pct-unit">%</span>
              </p>
              <p className="waterglass__name">
                <img
                  className="waterglass__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="waterglass__year">
                {fillTpl(t("home.water.year_label"), { year: sel.year })}
              </p>

              <p className="waterglass__note waterglass__note--have">
                {fillTpl(t("home.water.have_line"), { n: have })}
              </p>
              <p className="waterglass__note waterglass__note--gap">
                {fillTpl(t("home.water.gap_line"), { n: gap })}
              </p>

              {medianValue != null && (
                <p className="waterglass__legend">
                  <span
                    className="waterglass__legend-dash"
                    aria-hidden="true"
                  />
                  {fillTpl(t("home.water.median_label"), {
                    n: Math.round(medianValue),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="waterglass__source">{t("home.water.source")}</p>
      </div>
    </section>
  );
}