// src/components/WaterScroll/WaterScroll.jsx
// ============================================================
// CHAPITRE « Accès à l'eau » — scroll horizontal premium.
//   0) LE MOINS — mur de VERRES groupés par sous-région (Mélanésie / Polynésie /
//      Micronésie), chaque verre rempli à son niveau ; corail = sous 80 %.
//   1) LE PLUS — même mur ; cyan = quasi-total (≥ 99 %).
//   2) ÉVOLUTION — TrendLines (graphe de l'Acte) en pleine largeur.
// Grand verre d'origine (GlassVisual) à gauche sur 0 et 1 (territoire mis en
// avant), retiré sur l'évolution. Mini-verres statiques (anim de remplissage en
// cascade au passage, sans boucle par verre → perf OK). Fond neutre. Repli
// vertical mobile/reduced-motion. Données live `water`. Tokens, FR/EN.
// ============================================================

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { useLang } from "../../store/context/langContext";
import { isPict, pictName } from "../../i18n/pictNames";
import flagUrl from "../../i18n/flagUrl";
import GlassVisual from "../GlassVisual/GlassVisual";
import TrendLines from "../TrendLines/TrendLines";
import "./WaterScroll.scss";

gsap.registerPlugin(ScrollTrigger);

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
const REGION_ORDER = ["melanesia", "polynesia", "micronesia"];

const isReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function lastFinite(serie) {
  for (let i = serie.length - 1; i >= 0; i -= 1)
    if (Number.isFinite(serie[i].value)) return serie[i];
  return null;
}
function median(arr) {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function toSeries(byArea, lang) {
  if (!byArea) return [];
  return Object.entries(byArea)
    .filter(([code]) => isPict(code))
    .map(([code, serie]) => {
      const values = serie.filter((p) => Number.isFinite(p.value));
      if (!values.length) return null;
      return { area: code, name: pictName(code, lang), values };
    })
    .filter(Boolean);
}

/* ---------- Mini-verre (statique, remplissage animé au passage) ---------- */
const MG_TOP = 4;
const MG_BOT = 56;
const MG_SPAN = MG_BOT - MG_TOP;

function MiniGlass({ pct, name, valLabel, emph, tone, active, delay }) {
  const waterRef = useRef(null);
  useEffect(() => {
    const el = waterRef.current;
    if (!el) return undefined;
    const h = Math.max(0, Math.min(1, pct)) * MG_SPAN;
    if (isReduced() || !active) {
      el.setAttribute("y", String(MG_BOT - h));
      el.setAttribute("height", String(h));
      return undefined;
    }
    const tw = gsap.fromTo(
      el,
      { attr: { y: MG_BOT, height: 0 } },
      { attr: { y: MG_BOT - h, height: h }, duration: 0.7, ease: "power2.out", delay },
    );
    return () => tw.kill();
  }, [pct, active, delay]);

  return (
    <div
      className={`mglass ${emph ? "is-emph" : ""} ${
        emph && tone === "warm" ? "is-warm" : ""
      }`}
    >
      <svg className="mglass__svg" viewBox="0 0 44 64" role="img" aria-label={`${name} ${valLabel}`}>
        <rect
          ref={waterRef}
          className="mglass__water"
          x="8"
          y={MG_BOT}
          width="28"
          height="0"
          rx="5"
        />
        <path
          className="mglass__body"
          d="M7,4 L37,4 L33,55 Q32,58 28,58 L16,58 Q12,58 11,55 Z"
          fill="none"
        />
      </svg>
      <span className="mglass__name">{name}</span>
      <span className="mglass__val">{valLabel}</span>
    </div>
  );
}

/* ---------- Mur de verres par sous-région ---------- */
function RegionWall({ list, regionLabel, emphFn, tone, active }) {
  const groups = REGION_ORDER.map((r) => ({
    key: r,
    items: list.filter((o) => REGION_OF[o.code] === r).sort((a, b) => a.val - b.val),
  })).filter((g) => g.items.length);
  let idx = 0;
  return (
    <div className="rwall">
      {groups.map((g) => (
        <div className="rwall__group" key={g.key}>
          <p className="rwall__region">{regionLabel(g.key)}</p>
          <div className="rwall__row">
            {g.items.map((o) => {
              const d = idx;
              idx += 1;
              return (
                <MiniGlass
                  key={o.code}
                  pct={o.pct}
                  name={o.name}
                  valLabel={o.valLabel}
                  emph={emphFn(o)}
                  tone={tone}
                  active={active}
                  delay={d * 0.025}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WaterScroll() {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const nf = useMemo(
    () => new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US"),
    [lang],
  );

  const water = useSelector(selectDataset("water"));
  useEffect(() => {
    dispatch(loadDataset("water"));
  }, [dispatch]);

  const ready = water.status === "succeeded" && water.data;
  const failed = water.status === "failed";

  const model = useMemo(() => {
    if (!ready) return null;
    const unit = " %";
    const list = Object.entries(water.data.byArea)
      .filter(([code]) => isPict(code))
      .map(([code, serie]) => {
        const pt = lastFinite(serie);
        if (!pt || !Number.isFinite(pt.value)) return null;
        return {
          code,
          name: pictName(code, lang),
          val: pt.value,
          pct: pt.value / 100,
          valLabel: `${nf.format(Math.round(pt.value))}${unit}`,
        };
      })
      .filter(Boolean);
    if (list.length < 2) return null;

    const asc = [...list].sort((a, b) => a.val - b.val);
    const lowest = asc[0];
    const highest = asc[asc.length - 1];
    const med = median(list.map((o) => o.val)) ?? lowest.val;
    const wYears = water.data.years || [];

    return {
      list,
      lowest,
      highest,
      medPct: med / 100,
      waterSeries: toSeries(water.data.byArea, lang),
      waterYears: wYears,
      waterCur: wYears[wYears.length - 1],
      focus: [lowest, highest],
    };
  }, [ready, water.data, lang, nf]);

  const [step, setStep] = useState(0);
  const [simple, setSimple] = useState(false);
  const reduced = isReduced();

  const sectionRef = useRef(null);
  const pinRef = useRef(null);
  const panelRefs = useRef([]);
  const PANELS = 3;

  useLayoutEffect(() => {
    if (!model || typeof window === "undefined") return undefined;
    if (reduced || window.innerWidth < 760) {
      setSimple(true);
      return undefined;
    }
    setSimple(false);

    const ctx = gsap.context(() => {
      const panels = panelRefs.current.filter(Boolean);
      gsap.set(panels, {
        xPercent: (i) => (i === 0 ? 0 : 42),
        opacity: (i) => (i === 0 ? 1 : 0),
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pinRef.current,
          start: "top top",
          end: () => "+=" + window.innerHeight * (PANELS - 1) * 1.1,
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const s = Math.max(
              0,
              Math.min(PANELS - 1, Math.round(self.progress * (PANELS - 1))),
            );
            setStep((prev) => (prev === s ? prev : s));
          },
        },
      });

      for (let i = 1; i < PANELS; i += 1) {
        tl.to(panels[i - 1], { xPercent: -42, opacity: 0, ease: "power2.inOut", duration: 1 }, i - 1);
        tl.to(panels[i], { xPercent: 0, opacity: 1, ease: "power2.inOut", duration: 1 }, i - 1);
      }
    }, sectionRef);

    const id = window.setTimeout(() => ScrollTrigger.refresh(), 80);
    return () => {
      window.clearTimeout(id);
      ctx.revert();
    };
  }, [model, reduced]);

  if (failed) {
    return (
      <section className="wscroll wscroll--state">
        <p className="wscroll__state">{t("home.wscroll.unavailable")}</p>
      </section>
    );
  }
  if (!model) {
    return (
      <section className="wscroll wscroll--state">
        <p className="wscroll__state">{t("home.wscroll.loading")}</p>
      </section>
    );
  }

  const unit = " %";
  const glassShown = simple || step <= 1;
  const focus = model.focus[Math.min(step, model.focus.length - 1)];
  const regionLabel = (k) => t(`home.wscroll.region_${k}`);
  const captions = [
    t("home.wscroll.cap_low"),
    t("home.wscroll.cap_high"),
    t("home.wscroll.cap_evo"),
  ];
  const on = (i) => simple || step === i;

  const glassBlock = (
    <div className={`wscroll__glass ${glassShown ? "" : "is-hidden"}`}>
      <div className="wscroll__glass-wrap">
        <GlassVisual pct={focus.val / 100} median={model.medPct} />
      </div>
      <p className="wscroll__glass-label">
        <img
          className="wscroll__glass-flag"
          src={flagUrl(focus.code)}
          alt=""
          aria-hidden="true"
        />
        <span className="wscroll__glass-name">{focus.name}</span>
        <span className="wscroll__glass-val">
          {nf.format(Math.round(focus.val))}
          {unit}
        </span>
      </p>
    </div>
  );

  const paneInner = [
    <div className={`wscroll__pane ${on(0) ? "is-active" : ""}`} key="low">
      <p className="wscroll__kicker wscroll__kicker--warm">{t("home.wscroll.k_low")}</p>
      <h3 className="wscroll__title">{t("home.wscroll.t_low")}</h3>
      <div className="wscroll__chart">
        <RegionWall
          list={model.list}
          regionLabel={regionLabel}
          emphFn={(o) => o.val < 80}
          tone="warm"
          active={on(0)}
        />
      </div>
    </div>,
    <div className={`wscroll__pane ${on(1) ? "is-active" : ""}`} key="high">
      <p className="wscroll__kicker">{t("home.wscroll.k_high")}</p>
      <h3 className="wscroll__title">{t("home.wscroll.t_high")}</h3>
      <div className="wscroll__chart">
        <RegionWall
          list={model.list}
          regionLabel={regionLabel}
          emphFn={(o) => o.val >= 99}
          tone="accent"
          active={on(1)}
        />
      </div>
    </div>,
    <div className={`wscroll__pane wscroll__pane--wide ${on(2) ? "is-active" : ""}`} key="evo">
      <p className="wscroll__kicker">{t("home.wscroll.k_evo")}</p>
      <h3 className="wscroll__title">{t("home.wscroll.t_evo")}</h3>
      <div className="wscroll__chart wscroll__trend">
        <TrendLines
          series={model.waterSeries}
          years={model.waterYears}
          currentYear={model.waterCur}
          unit={unit}
        />
      </div>
    </div>,
  ];

  if (simple) {
    return (
      <section className="wscroll wscroll--simple" ref={sectionRef}>
        <p className="wscroll__chapter">{t("home.wscroll.kicker")}</p>
        {glassBlock}
        {paneInner.map((p, i) => (
          <div className="wscroll__simple-panel" key={i}>
            {p}
            <p className="wscroll__simple-cap">{captions[i]}</p>
          </div>
        ))}
        <p className="wscroll__source">{t("home.wscroll.source")}</p>
      </section>
    );
  }

  return (
    <section className="wscroll" ref={sectionRef}>
      <div className="wscroll__pin" ref={pinRef}>
        <p className="wscroll__chapter">{t("home.wscroll.kicker")}</p>
        {glassBlock}
        <div className="wscroll__stage">
          {paneInner.map((p, i) => (
            <div
              className="wscroll__panel"
              key={i}
              ref={(el) => {
                panelRefs.current[i] = el;
              }}
            >
              {p}
            </div>
          ))}
          <div className="wscroll__hud">
            <p className="wscroll__caption" key={step}>
              {captions[step]}
            </p>
            <div className="wscroll__dots" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className={i === step ? "is-on" : ""} />
              ))}
            </div>
            {step === 0 && (
              <p className="wscroll__hint" aria-hidden="true">
                {t("home.wscroll.hint")}
              </p>
            )}
          </div>
        </div>
      </div>
      <p className="wscroll__source">{t("home.wscroll.source")}</p>
    </section>
  );
}