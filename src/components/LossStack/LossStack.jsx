// src/components/LossStack/LossStack.jsx
// ============================================================
// SECTION SIGNATURE — « Le poids des catastrophes : les pertes » (Home). Une
// PILE DE PIÈCES monte selon les PERTES ÉCONOMIQUES (perte annuelle moyenne,
// dommages directs, en US$) du territoire, via le dataset live `disastersLoss`
// (UNDRR — Cadre de Sendai · ODD 11.5.2 · VC_DSR_AALT).
//
// Honnête : grand nombre = perte RÉELLE (dernière année, format compact US$) ;
// la HAUTEUR de la pile encode la perte normalisée sur l'amplitude du Pacifique
// en ÉCHELLE LOG (dit sous le visuel — les pertes s'étalent sur plusieurs ordres
// de grandeur) ; tendance « depuis {année} » réelle (hausse = pire, corail ;
// baisse = mieux, vert). Léger balancement (rAF) ; empilement animé par GSAP.
// prefers-reduced-motion respecté. <section>/ref toujours montés. Tokens, FR/EN,
// zéro inline.
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
import "./LossStack.scss";

// ---------------------------------------------------------------------------
// DES PIÈCES, ET PLUSIEURS PILES.
//
// C'était UNE colonne de dix-huit ellipses plates, larges de 60 px, collées les
// unes aux autres. Le résultat ne ressemblait pas à des pièces — il n'y avait
// ni tranche, ni relief, ni bord : des crêpes empilées. Et une colonne unique
// ne se jauge pas : à quinze ellipses on ne sait pas si c'est beaucoup.
//
// Quatre piles de huit, comme on compte réellement de la monnaie. Une pièce est
// un CYLINDRE vu de trois quarts : une face elliptique, une tranche en dessous,
// un liseré. Plus petites, il en tient davantage, et la quantité redevient
// jaugeable — quatre piles pleines, ou une pile et demie.
//
// Comme pour la foule et le village, c'est le NOMBRE qui porte la valeur, et
// la décimale devient une pièce plus petite posée au sommet.
// ---------------------------------------------------------------------------

const STACKS = 4;
const PER_STACK = 8;
const N = STACKS * PER_STACK;
const STACK_X = [56, 106, 156, 206];
const BASE_Y = 250;
const GAP = 11;
const RX = 21;
const RY = 6.2;
const THICK = 4.6;

// Ordre de remplissage : pile par pile, de bas en haut. On empile vraiment,
// on ne saupoudre pas — une pile à trous n'est pas une pile.
const COINS = Array.from({ length: N }, (_, i) => {
  const col = Math.floor(i / PER_STACK);
  const row = i % PER_STACK;
  return {
    cx: STACK_X[col],
    cy: BASE_Y - row * GAP,
    alt: (col + row) % 2 === 0,
  };
});

function median(arr) {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function firstFinite(serie) {
  for (let i = 0; i < serie.length; i += 1)
    if (Number.isFinite(serie[i].value)) return serie[i];
  return null;
}
function lastFinite(serie) {
  for (let i = serie.length - 1; i >= 0; i -= 1)
    if (Number.isFinite(serie[i].value)) return serie[i];
  return null;
}
function fillTpl(str, map) {
  return Object.entries(map).reduce(
    (s, [k, val]) => s.split(`{${k}}`).join(String(val)),
    String(str),
  );
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default function LossStack({ embed = false, code = null } = {}) {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const [ref, inView, visible] = useInView({ threshold: 0.2 });
  const nf = useMemo(
    () => new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US"),
    [lang],
  );
  const nfC = useMemo(
    () =>
      new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [lang],
  );

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ds = useSelector(selectDataset("disastersLoss"));

  useEffect(() => {
    dispatch(loadDataset("disastersLoss"));
  }, [dispatch]);

  const status = ds.status;
  const ready = status === "succeeded" && ds.data;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(ds.data.byArea)
      .filter(([code]) => isPict(code))
      .map(([code, serie]) => {
        const pt = lastFinite(serie);
        if (!pt || !(pt.value >= 0)) return null;
        const f = firstFinite(serie);
        return {
          code,
          name: pictName(code, lang),
          val: pt.value,
          year: pt.year,
          delta: f ? pt.value - f.value : null,
          fromYear: f ? f.year : null,
        };
      })
      .filter(Boolean);
    if (!raw.length) return [];
    const vals = raw.map((o) => o.val);
    const vMin = Math.min(...vals);
    const vMax = Math.max(...vals);
    // Échelle LOG : les pertes s'étalent sur plusieurs ordres de grandeur.
    const denom = Math.log1p(vMax - vMin) || 1;
    return raw
      .map((o) => ({ ...o, v: clamp01(Math.log1p(o.val - vMin) / denom) }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [ready, ds.data, lang]);

  const byCode = useMemo(() => {
    const m = {};
    list.forEach((o) => {
      m[o.code] = o;
    });
    return m;
  }, [list]);

  const medianVal = useMemo(() => median(list.map((o) => o.val)), [list]);
  const extremes = useMemo(() => {
    if (!list.length) return null;
    let high = list[0];
    let low = list[0];
    list.forEach((o) => {
      if (o.val > high.val) high = o;
      if (o.val < low.val) low = o;
    });
    return { high, low };
  }, [list]);

  // Défaut : la plus lourde (pile la plus haute).
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(extremes ? extremes.high.code : list[0].code);
    }
  }, [list, selected, byCode, extremes]);

  const sel = selected ? byCode[selected] : null;
  useEffect(() => {
    if (embed && code) setSelected(code);
  }, [embed, code]);

  /* ----------- Empilement ----------- */
  const stackRef = useRef(null);
  const coinRefs = useRef([]);
  const numberRef = useRef(null);
  const animObj = useRef({ v: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const v = animObj.current.v;
      if (numberRef.current)
        numberRef.current.textContent = nfC.format(Math.round(animObj.current.val));

      if (stackRef.current) {
        const bob = reduced ? 0 : 1.2 * Math.sin(phase * 1.3);
        stackRef.current.setAttribute(
          "transform",
          `translate(0 ${bob.toFixed(2)})`,
        );
      }

      // Le NOMBRE de pièces porte la valeur ; la dernière rétrécit pour la
      // décimale. Les pièces tombaient auparavant en fondu depuis le haut :
      // à mi-course on voyait des disques à demi transparents flotter
      // au-dessus de la pile, ce qui ne ressemble à rien de physique.
      const shown = v * N;
      coinRefs.current.forEach((node, i) => {
        if (!node) return;
        const part = clamp01(shown - i);
        const eased = 1 - (1 - part) * (1 - part);
        // Rampe large, comme pour la foule : à ×10 la pièce apparaissait d'un
        // coup, et pendant une transition plusieurs surgissaient ensemble.
        const sc = 0.32 + 0.68 * eased;
        const c = COINS[i];
        node.setAttribute(
          "transform",
          `translate(${c.cx} ${c.cy}) scale(${sc.toFixed(3)}) translate(${-c.cx} ${-c.cy})`,
        );
        node.setAttribute("opacity", clamp01(part / 0.35).toFixed(3));
      });
    },
    [reduced, nfC],
  );

  useEffect(() => {
    if (!sel) return undefined;
    if (inView) startedRef.current = true;

    if (reduced || !startedRef.current) {
      animObj.current.v = sel.v;
      animObj.current.val = sel.val;
      draw(0);
      return undefined;
    }
    const tw = gsap.to(animObj.current, {
      v: sel.v,
      val: sel.val,
      duration: 1.6,
      ease: "power2.inOut",
    });
    return () => tw.kill();
  }, [inView, sel, reduced, draw]);

  useEffect(() => {
    if (reduced) {
      draw(0);
      return undefined;
    }
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

  const loading = status === "loading" || status === "idle";
  const failed = status === "failed";
  const empty = ready && list.length === 0;

  const valText = sel ? nfC.format(Math.round(sel.val)) : "0";

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (d === 0)
      return (
        <span className="loss__trend loss__trend--flat">
          {fillTpl(t("home.loss.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="loss__trend loss__trend--up">
          {fillTpl(t("home.loss.trend_up"), {
            n: nfC.format(Math.round(d)),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="loss__trend loss__trend--down">
        {fillTpl(t("home.loss.trend_down"), {
          n: nfC.format(Math.abs(Math.round(d))),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.loss.aria"), {
        area: sel.name,
        n: nf.format(Math.round(sel.val)),
        year: sel.year,
      })
    : t("home.loss.title");

  return (
    <section
      className={`loss ${embed ? "loss--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="loss__inner container">
        <header className="loss__head">
          <p className="eyebrow loss__kicker">{t("home.loss.kicker")}</p>
          <h2 className="loss__title">{t("home.loss.title")}</h2>
          <p className="loss__lead">{t("home.loss.lead")}</p>
        </header>

        {loading && <p className="loss__state">{t("home.loss.loading")}</p>}
        {(failed || empty) && (
          <p className="loss__state loss__state--err">
            {t("home.loss.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="loss__stage">
            {/* Colonne 1 — contrôles */}
            <div className="loss__controls">
              <label className="loss__field">
                <span className="loss__field-label">
                  {t("home.loss.select_label")}
                </span>
                <span className="loss__select">
                  <img
                    className="loss__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="loss__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.loss.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="loss__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                <div className="loss__chips">
                  <button
                    type="button"
                    className="loss__chip"
                    onClick={() => setSelected(extremes.high.code)}
                  >
                    {t("home.loss.highest")}
                    <em>{nfC.format(Math.round(extremes.high.val))}</em>
                  </button>
                  <button
                    type="button"
                    className="loss__chip"
                    onClick={() => setSelected(extremes.low.code)}
                  >
                    {t("home.loss.lowest")}
                    <em>{nfC.format(Math.round(extremes.low.val))}</em>
                  </button>
                </div>
              )}
            </div>

            {/* Colonne 2 — la pile de pièces */}
            <figure className="loss__viz">
              <svg
                className="loss__svg"
                viewBox="0 0 260 280"
                role="img"
                aria-label={svgLabel}
              >
                {/* Une ombre par pile, pas un socle unique. */}
                {STACK_X.map((x, i) => (
                  <ellipse
                    key={i}
                    className="loss__base"
                    cx={x}
                    cy="262"
                    rx={RX + 4}
                    ry="6"
                  />
                ))}

                <g ref={stackRef}>
                  {COINS.map((coin, i) => (
                    <g
                      key={i}
                      ref={(n) => {
                        coinRefs.current[i] = n;
                      }}
                      className="loss__coin"
                      opacity="0"
                    >
                      {/* UNE PIÈCE EST UN CYLINDRE, pas un disque.
                          Trois pièces : la tranche (le corps), la face du
                          dessus, et un liseré. Sans la tranche, on empilait
                          des crêpes. */}
                      <path
                        className="loss__coin-edge"
                        d={`M${coin.cx - RX},${coin.cy}
                            L${coin.cx - RX},${coin.cy + THICK}
                            A${RX},${RY} 0 0 0 ${coin.cx + RX},${coin.cy + THICK}
                            L${coin.cx + RX},${coin.cy} Z`}
                      />
                      <ellipse
                        className={
                          coin.alt
                            ? "loss__coin-face"
                            : "loss__coin-face loss__coin-face--alt"
                        }
                        cx={coin.cx}
                        cy={coin.cy}
                        rx={RX}
                        ry={RY}
                      />
                      {/* Le liseré : c'est lui qui sépare deux pièces
                          voisines, sinon la pile est un bloc uni. */}
                      <ellipse
                        className="loss__coin-rim"
                        cx={coin.cx}
                        cy={coin.cy}
                        rx={RX - 3.4}
                        ry={RY - 1.6}
                        fill="none"
                      />
                      <ellipse
                        className="loss__coin-shine"
                        cx={coin.cx - 6}
                        cy={coin.cy - 1.4}
                        rx="6"
                        ry="1.8"
                      />
                    </g>
                  ))}
                </g>
              </svg>
              <figcaption className="loss__viz-cap">
                {t("home.loss.height_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="loss__readout">
              <p className="loss__val">
                <span ref={numberRef} className="loss__val-num">
                  {valText}
                </span>
                <span className="loss__val-unit">{t("home.loss.unit")}</span>
              </p>
              <p className="loss__val-cap">{t("home.loss.value_caption")}</p>
              <p className="loss__name">
                <img
                  className="loss__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="loss__year">
                {fillTpl(t("home.loss.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="loss__legend">
                  {fillTpl(t("home.loss.median_label"), {
                    n: nfC.format(Math.round(medianVal)),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="loss__source">{t("home.loss.source")}</p>
      </div>
    </section>
  );
}