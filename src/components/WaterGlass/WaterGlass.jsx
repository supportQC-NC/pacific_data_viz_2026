// src/components/WaterGlass/WaterGlass.jsx
// ============================================================
// SECTION SIGNATURE — « Un verre d'eau » (Home).
// L'utilisateur choisit un territoire ; le VERRE se remplit (ou se vide)
// jusqu'à la PART de population disposant d'une eau potable GÉRÉE EN
// SÉCURITÉ (ODD 6.1.1, indicateur SH_H2O_SAFE, OMS/UNICEF JMP), via le
// dataset live `water` du Pacific Data Hub.
//
// Lecture « plus parlante » :
//   • niveau d'eau = ce qui EST acquis (grand % à droite) ;
//   • le VIDE au-dessus porte le manque : le nombre de personnes SANS accès
//     s'inscrit dans la partie vide du verre (« à moitié vide » rendu réel),
//     et s'efface quand l'espace devient trop petit ;
//   • repères 25/50/75 gravés sur la paroi → le niveau se lit comme une
//     mesure ; une ligne pointillée marque la MÉDIANE du Pacifique.
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

const SUBREGIONS = {
  melanesia: ["FJ", "PG", "SB", "VU", "NC"],
  polynesia: ["PF", "WS", "TO", "TV", "CK", "NU", "WF", "TK", "AS", "PN"],
  micronesia: ["FM", "GU", "MP", "MH", "NR", "PW", "KI"],
};
const REGION_OF = {};
Object.entries(SUBREGIONS).forEach(([r, codes]) =>
  codes.forEach((c) => {
    REGION_OF[c] = r;
  }),
);
const REGION_TABS = ["all", "melanesia", "polynesia", "micronesia"];

/* ---- Géométrie du verre (repère SVG, viewBox 0 0 240 300) ---- */
const TOP = 54; // y du bord intérieur haut (eau pleine)
const BOT = 260; // y du fond intérieur (eau vide)
const SPAN = BOT - TOP;
const WX0 = 28; // bornes x de l'eau (plus large que le verre : rognée par le clip)
const WX1 = 212;
const WBOT = 280; // fond du tracé d'eau
const STEP = 8; // pas d'échantillonnage de la vague
const GAP_MIN_PX = 50; // espace vide minimal pour afficher le déficit

const yForPct = (pct) => BOT - pct * SPAN;

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

export default function WaterGlass({ embed = false, code = null } = {}) {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView, visible] = useInView({ threshold: 0.25 });

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
        // Valeur À L'ÉCHELLE DU TERRITOIRE : dernière année disponible, médiane
        // des valeurs de cette année (robuste si la source détaille
        // urbain/rural/total — la médiane ≈ le total du territoire).
        const byYear = {};
        serie.forEach((p) => {
          if (Number.isFinite(p.value))
            (byYear[p.year] = byYear[p.year] || []).push(p.value);
        });
        const yrs = Object.keys(byYear)
          .map(Number)
          .sort((a, b) => a - b);
        if (!yrs.length) return null;
        const year = yrs[yrs.length - 1];
        const v = median(byYear[year]);
        if (!Number.isFinite(v)) return null;
        return {
          code,
          name: pictName(code, lang),
          value: Math.max(0, Math.min(100, v)),
          year,
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

  const medianValue = useMemo(() => median(list.map((o) => o.value)), [list]);
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

  /* Sélection : un PAYS ou une SOUS-RÉGION (agrégat de tous ses pays). */
  const [region, setRegion] = useState("all");
  const [view, setView] = useState(null); // {kind:"country",code} | {kind:"region",key}
  useEffect(() => {
    if (embed) return;
    if (!list.length) return;
    if (!view || (view.kind === "country" && !byCode[view.code])) {
      setView({ kind: "country", code: byCode.FJ ? "FJ" : list[0].code });
    }
  }, [list, view, byCode, embed]);
  useEffect(() => {
    if (embed && code) setView({ kind: "country", code });
  }, [embed, code]);

  const selectCountry = (code) => setView({ kind: "country", code });
  const selectRegion = (key) => {
    setRegion(key);
    setView({ kind: "region", key });
  };

  const sel = useMemo(() => {
    if (!view) return null;
    if (view.kind === "country") {
      const o = byCode[view.code];
      return o ? { ...o, isRegion: false } : null;
    }
    const members =
      view.key === "all"
        ? list
        : list.filter((o) => REGION_OF[o.code] === view.key);
    if (!members.length) return null;
    const avg = members.reduce((acc, o) => acc + o.value, 0) / members.length;
    const year = Math.max(...members.map((o) => o.year));
    const name =
      view.key === "all"
        ? t("home.water.region_pacific")
        : t(`home.water.region_${view.key}`);
    return {
      code: null,
      name,
      value: avg,
      year,
      isRegion: true,
      count: members.length,
    };
  }, [view, byCode, list, t]);
  const selPct = sel ? sel.value / 100 : 0;

  /* Liste filtrée par sous-région pour les chips. */
  const visibleList = useMemo(
    () =>
      region === "all"
        ? list
        : list.filter((o) => REGION_OF[o.code] === region),
    [list, region],
  );

  /* ----------- Animation : eau vivante (vague + bulles + déficit) ----------- */
  const waterRef = useRef(null);
  const surfaceRef = useRef(null);
  const numberRef = useRef(null); // grand % (acquis)
  const deficitGroupRef = useRef(null); // groupe « manque » dans le vide
  const deficitNumRef = useRef(null);
  const levelObj = useRef({ p: 0 });
  const startedRef = useRef(false);

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
      if (numberRef.current)
        numberRef.current.textContent = String(Math.round(p * 100));

      // Déficit dans la partie vide (« à moitié vide » rendu réel).
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
            deficitNumRef.current.textContent = String(
              100 - Math.round(p * 100),
            );
        }
      }

      // Bulles.
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
    if (!visible) return undefined;
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
  }, [reduced, visible, draw]);

  /* Repères de mesure (statiques) + médiane. */
  const ticks = [0.25, 0.5, 0.75];
  const medianY = medianValue != null ? yForPct(medianValue / 100) : null;

  const loading = status === "loading" || status === "idle";
  const failed = status === "failed";
  const empty = ready && list.length === 0;

  const have = sel ? Math.round(sel.value) : 0;
  const gap = 100 - have;

  const svgLabel = sel
    ? fillTpl(t("home.water.aria"), { area: sel.name, n: have, year: sel.year })
    : t("home.water.title");

  return (
    <section
      className={`waterglass ${embed ? "waterglass--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="waterglass__inner container">
        {!embed && (
          <header className="waterglass__head">
            <h2 className="waterglass__title">{t("home.water.title")}</h2>
            <p className="waterglass__lead">{t("home.water.lead")}</p>
          </header>
        )}

        {loading && (
          <p className="waterglass__state">{t("home.water.loading")}</p>
        )}
        {(failed || empty) && (
          <p className="waterglass__state waterglass__state--err">
            {t("home.water.unavailable")}
          </p>
        )}

        {ready && sel && (
          <>
          {!embed && (
          <div className="waterglass__toolbar">
            <span className="waterglass__field-label">
              {t("home.water.select_label")}
            </span>
            <div className="waterglass__regions" role="tablist">
              {REGION_TABS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={region === r}
                  className={`waterglass__region ${region === r ? "is-on" : ""}`}
                  onClick={() => selectRegion(r)}
                >
                  {t(`home.water.region_${r}`)}
                </button>
              ))}
            </div>
            {extremes && (
              <div className="waterglass__chips">
                <button
                  type="button"
                  className="waterglass__chip waterglass__chip--best"
                  onClick={() => selectCountry(extremes.best.code)}
                >
                  {t("home.water.highest")}
                  <em>{Math.round(extremes.best.value)}%</em>
                </button>
                <button
                  type="button"
                  className="waterglass__chip waterglass__chip--least"
                  onClick={() => selectCountry(extremes.least.code)}
                >
                  {t("home.water.lowest")}
                  <em>{Math.round(extremes.least.value)}%</em>
                </button>
              </div>
            )}
          </div>
          )}

          <div className={`waterglass__stage ${embed ? "waterglass__stage--embed" : ""}`}>

            {/* Colonne 2 — le verre */}
            <figure className="waterglass__viz">
              <svg
                className="waterglass__svg"
                viewBox="0 0 240 300"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  <clipPath id="wg-inner">
                    <path d="M42,52 L198,52 L182,250 Q180,260 170,260 L70,260 Q60,260 58,250 Z" />
                  </clipPath>
                  <linearGradient id="wg-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" className="waterglass__stop-top" />
                    <stop offset="0.55" className="waterglass__stop-mid" />
                    <stop offset="1" className="waterglass__stop-bot" />
                  </linearGradient>
                </defs>

                <g clipPath="url(#wg-inner)">
                  {/* Cavité (verre vide) */}
                  <rect
                    className="waterglass__cavity"
                    x="30"
                    y="46"
                    width="180"
                    height="230"
                  />

                  {/* Repères de mesure gravés (25/50/75) */}
                  {ticks.map((tk) => (
                    <line
                      key={tk}
                      className="waterglass__tick"
                      x1="46"
                      x2="64"
                      y1={yForPct(tk)}
                      y2={yForPct(tk)}
                    />
                  ))}

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
                      x1="52"
                      x2="188"
                      y1={medianY}
                      y2={medianY}
                    />
                  )}

                  {/* Déficit, inscrit dans le vide */}
                  <g
                    ref={deficitGroupRef}
                    className="waterglass__deficit"
                    opacity="0"
                  >
                    <text
                      ref={deficitNumRef}
                      className="waterglass__deficit-num"
                      x="0"
                      y="0"
                      textAnchor="middle"
                    >
                      {gap}
                    </text>
                    <text
                      className="waterglass__deficit-cap"
                      x="0"
                      y="18"
                      textAnchor="middle"
                    >
                      {t("home.water.gap_short")}
                    </text>
                  </g>
                </g>

                {/* Contour + ouverture du verre */}
                <path
                  className="waterglass__glass"
                  d="M34,46 L206,46 L188,258 Q186,270 174,270 L66,270 Q54,270 52,258 Z"
                />
                <ellipse
                  className="waterglass__rim"
                  cx="120"
                  cy="46"
                  rx="86"
                  ry="9"
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
                {sel.code && (
                  <img
                    className="waterglass__name-flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                )}
                {sel.name}
                {sel.isRegion && (
                  <span className="waterglass__name-tag">
                    {fillTpl(t("home.water.region_avg"), { n: sel.count })}
                  </span>
                )}
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
                  <span className="waterglass__legend-dash" aria-hidden="true" />
                  {fillTpl(t("home.water.median_label"), {
                    n: Math.round(medianValue),
                  })}
                </p>
              )}
            </div>
          </div>

          {!embed && (
          <div className="waterglass__countrybar">
            <div className="waterglass__countries">
              {visibleList.map((o) => (
                <button
                  key={o.code}
                  type="button"
                  className={`waterglass__country ${
                    view && view.kind === "country" && view.code === o.code
                      ? "is-on"
                      : ""
                  }`}
                  aria-pressed={
                    view && view.kind === "country" && view.code === o.code
                  }
                  onClick={() => selectCountry(o.code)}
                >
                  <img
                    className="waterglass__country-flag"
                    src={flagUrl(o.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <span className="waterglass__country-name">{o.name}</span>
                  <em className="waterglass__country-val">{Math.round(o.value)}%</em>
                </button>
              ))}
            </div>
          </div>
          )}
          </>
        )}

        {!embed && (
          <p className="waterglass__source">{t("home.water.source")}</p>
        )}
      </div>
    </section>
  );
}