// src/components/EnergyCell/EnergyCell.jsx
// ============================================================
// SECTION SIGNATURE #2 — « La cellule d'énergie » (Home), pendant du verre
// d'eau. Même moteur d'animation (niveau de fluide qui monte + surface
// vivante), objet différent : une CELLULE / BATTERIE qui se CHARGE jusqu'à la
// PART d'énergie RENOUVELABLE dans la consommation finale (ODD 7.2.1,
// indicateur EG_FEC_RNEW), via le dataset live `renewables` du Pacific Data
// Hub.
//
// Lecture :
//   • niveau de charge = part déjà renouvelable (grand % à droite, en vert) ;
//   • le VIDE au-dessus = part encore FOSSILE (100 − renouvelable), inscrit
//     dans l'espace vide de la cellule, et s'efface quand la charge est haute ;
//   • repères 25/50/75 + ligne pointillée = MÉDIANE du Pacifique.
//
// Aucune valeur inventée : seuls les territoires AYANT une donnée (dernière
// année connue) sont proposés. Surface + étincelles pilotées par rAF (attributs
// SVG, pas de re-render par frame) ; charge animée par GSAP. prefers-reduced-
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
import "./EnergyCell.scss";

/* ---- Géométrie de la cellule (repère SVG, viewBox 0 0 240 300) ---- */
const TOP = 70; // y du bord intérieur haut (charge pleine)
const BOT = 256; // y du fond intérieur (charge vide)
const SPAN = BOT - TOP;
const WX0 = 56; // bornes x de la charge (plus large que la cellule : rognée)
const WX1 = 184;
const WBOT = 270;
const STEP = 8;
const GAP_MIN_PX = 46;

const yForPct = (pct) => BOT - pct * SPAN;

function median(arr) {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function lastFinite(serie) {
  for (let i = serie.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(serie[i].value)) return serie[i];
  }
  return null;
}

function fillTpl(str, map) {
  return Object.entries(map).reduce(
    (s, [k, val]) => s.split(`{${k}}`).join(String(val)),
    String(str),
  );
}

export default function EnergyCell({ embed = false, code = null } = {}) {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView, visible] = useInView({ threshold: 0.25 });

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const energy = useSelector(selectDataset("renewables"));

  useEffect(() => {
    dispatch(loadDataset("renewables"));
  }, [dispatch]);

  const status = energy.status;
  const ready = status === "succeeded" && energy.data;

  const list = useMemo(() => {
    if (!ready) return [];
    return Object.entries(energy.data.byArea)
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
  }, [ready, energy.data, lang]);

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

  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (embed) return;
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(byCode.FJ ? "FJ" : list[0].code);
    }
  }, [list, selected, byCode, embed]);
  useEffect(() => {
    if (embed && code) setSelected(code);
  }, [embed, code]);

  const sel = selected ? byCode[selected] : null;
  const selPct = sel ? sel.value / 100 : 0;

  /* ----------- Animation : charge vivante (surface + étincelles + déficit) ----------- */
  const chargeRef = useRef(null);
  const surfaceRef = useRef(null);
  const numberRef = useRef(null);
  const deficitGroupRef = useRef(null);
  const deficitNumRef = useRef(null);
  const levelObj = useRef({ p: 0 });
  const startedRef = useRef(false);

  const sparks = useMemo(
    () => [
      { x: 96, r: 2.4, speed: 0.42, off: 0.0 },
      { x: 128, r: 1.7, speed: 0.5, off: 0.35 },
      { x: 112, r: 2.8, speed: 0.36, off: 0.62 },
      { x: 144, r: 1.9, speed: 0.46, off: 0.18 },
      { x: 84, r: 1.6, speed: 0.56, off: 0.8 },
    ],
    [],
  );
  const sparkRefs = useRef([]);

  const wavePath = useCallback((levelY, phase, close) => {
    const amp = 3.4;
    const amp2 = 2;
    let d = "";
    for (let x = WX0; x <= WX1; x += STEP) {
      const y =
        levelY +
        amp * Math.sin(x * 0.06 + phase * 1.8) +
        amp2 * Math.sin(x * 0.11 - phase * 1.2);
      d += `${d ? " L" : "M"}${x.toFixed(1)},${y.toFixed(2)}`;
    }
    if (close) d += ` L${WX1},${WBOT} L${WX0},${WBOT} Z`;
    return d;
  }, []);

  const draw = useCallback(
    (phase) => {
      const p = levelObj.current.p;
      const levelY = yForPct(p);

      if (chargeRef.current)
        chargeRef.current.setAttribute("d", wavePath(levelY, phase, true));
      if (surfaceRef.current)
        surfaceRef.current.setAttribute("d", wavePath(levelY, phase, false));
      if (numberRef.current)
        numberRef.current.textContent = String(Math.round(p * 100));

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
          const op = Math.min(1, (emptyPx - GAP_MIN_PX) / 24) * 0.96;
          deficitGroupRef.current.setAttribute("opacity", op.toFixed(3));
          if (deficitNumRef.current)
            deficitNumRef.current.textContent = String(
              100 - Math.round(p * 100),
            );
        }
      }

      sparkRefs.current.forEach((node, i) => {
        if (!node) return;
        const b = sparks[i];
        if (reduced || p <= 0.02) {
          node.setAttribute("opacity", "0");
          return;
        }
        const span = BOT - levelY;
        const prog = (phase * b.speed + b.off) % 1;
        const cy = BOT - prog * span;
        const drift = Math.sin(phase * 2 + i) * 2;
        node.setAttribute("cx", (b.x + drift).toFixed(1));
        node.setAttribute("cy", cy.toFixed(1));
        node.setAttribute("r", (b.r * (0.5 + 0.5 * (1 - prog))).toFixed(2));
        node.setAttribute("opacity", (0.7 * Math.sin(Math.PI * prog)).toFixed(3));
      });
    },
    [wavePath, sparks, reduced],
  );

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

  const ticks = [0.25, 0.5, 0.75];
  const medianY = medianValue != null ? yForPct(medianValue / 100) : null;

  const loading = status === "loading" || status === "idle";
  const failed = status === "failed";
  const empty = ready && list.length === 0;

  const have = sel ? Math.round(sel.value) : 0;
  const gap = 100 - have;

  const svgLabel = sel
    ? fillTpl(t("home.energy.aria"), { area: sel.name, n: have, year: sel.year })
    : t("home.energy.title");

  return (
    <section
      className={`energycell ${embed ? "energycell--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="energycell__inner container">
        {!embed && (
          <header className="energycell__head">
            <p className="eyebrow energycell__kicker">
              {t("home.energy.kicker")}
            </p>
            <h2 className="energycell__title">{t("home.energy.title")}</h2>
            <p className="energycell__lead">{t("home.energy.lead")}</p>
          </header>
        )}

        {loading && (
          <p className="energycell__state">{t("home.energy.loading")}</p>
        )}
        {(failed || empty) && (
          <p className="energycell__state energycell__state--err">
            {t("home.energy.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className={`energycell__stage ${embed ? "energycell__stage--embed" : ""}`}>
            {!embed && (
            <div className="energycell__controls">
              <label className="energycell__field">
                <span className="energycell__field-label">
                  {t("home.energy.select_label")}
                </span>
                <span className="energycell__select">
                  <img
                    className="energycell__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="energycell__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.energy.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="energycell__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="energycell__chips">
                  <button
                    type="button"
                    className="energycell__chip"
                    onClick={() => setSelected(extremes.best.code)}
                  >
                    {t("home.energy.highest")}
                    <em>{Math.round(extremes.best.value)}%</em>
                  </button>
                  <button
                    type="button"
                    className="energycell__chip"
                    onClick={() => setSelected(extremes.least.code)}
                  >
                    {t("home.energy.lowest")}
                    <em>{Math.round(extremes.least.value)}%</em>
                  </button>
                </div>
              )}
            </div>
            )}

            {/* Colonne 2 — la cellule */}
            <figure className="energycell__viz">
              <svg
                className="energycell__svg"
                viewBox="0 0 240 300"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  <clipPath id="ec-inner">
                    <rect x="68" y="70" width="104" height="186" rx="12" />
                  </clipPath>
                  <linearGradient id="ec-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" className="energycell__stop-top" />
                    <stop offset="0.55" className="energycell__stop-mid" />
                    <stop offset="1" className="energycell__stop-bot" />
                  </linearGradient>
                </defs>

                <g clipPath="url(#ec-inner)">
                  {/* Cavité (cellule vide) */}
                  <rect
                    className="energycell__cavity"
                    x="64"
                    y="66"
                    width="112"
                    height="194"
                  />

                  {/* Repères de mesure (25/50/75) */}
                  {ticks.map((tk) => (
                    <line
                      key={tk}
                      className="energycell__tick"
                      x1="74"
                      x2="92"
                      y1={yForPct(tk)}
                      y2={yForPct(tk)}
                    />
                  ))}

                  {/* Charge */}
                  <path
                    ref={chargeRef}
                    className="energycell__charge"
                    fill="url(#ec-fill)"
                    d=""
                  />
                  <path
                    ref={surfaceRef}
                    className="energycell__surface"
                    fill="none"
                    d=""
                  />

                  {/* Étincelles */}
                  {sparks.map((b, i) => (
                    <circle
                      key={i}
                      ref={(n) => {
                        sparkRefs.current[i] = n;
                      }}
                      className="energycell__spark"
                      cx={b.x}
                      cy={BOT}
                      r={b.r}
                      opacity="0"
                    />
                  ))}

                  {/* Médiane du Pacifique */}
                  {medianY != null && (
                    <line
                      className="energycell__median"
                      x1="72"
                      x2="168"
                      y1={medianY}
                      y2={medianY}
                    />
                  )}

                  {/* Déficit fossile, inscrit dans le vide */}
                  <g
                    ref={deficitGroupRef}
                    className="energycell__deficit"
                    opacity="0"
                  >
                    <text
                      ref={deficitNumRef}
                      className="energycell__deficit-num"
                      x="0"
                      y="0"
                      textAnchor="middle"
                    >
                      {gap}
                    </text>
                    <text
                      className="energycell__deficit-cap"
                      x="0"
                      y="18"
                      textAnchor="middle"
                    >
                      {t("home.energy.gap_short")}
                    </text>
                  </g>
                </g>

                {/* Corps + borne de la cellule */}
                <rect
                  className="energycell__cell"
                  x="58"
                  y="58"
                  width="124"
                  height="212"
                  rx="18"
                />
                <rect
                  className="energycell__cap"
                  x="98"
                  y="42"
                  width="44"
                  height="18"
                  rx="6"
                />
              </svg>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="energycell__readout">
              <p className="energycell__pct">
                <span ref={numberRef} className="energycell__pct-num">
                  {have}
                </span>
                <span className="energycell__pct-unit">%</span>
              </p>
              <p className="energycell__name">
                <img
                  className="energycell__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="energycell__year">
                {fillTpl(t("home.energy.year_label"), { year: sel.year })}
              </p>

              <p className="energycell__note energycell__note--have">
                {fillTpl(t("home.energy.have_line"), { n: have })}
              </p>
              <p className="energycell__note energycell__note--gap">
                {fillTpl(t("home.energy.gap_line"), { n: gap })}
              </p>

              {medianValue != null && (
                <p className="energycell__legend">
                  <span
                    className="energycell__legend-dash"
                    aria-hidden="true"
                  />
                  {fillTpl(t("home.energy.median_label"), {
                    n: Math.round(medianValue),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        {!embed && (
          <p className="energycell__source">{t("home.energy.source")}</p>
        )}
      </div>
    </section>
  );
}