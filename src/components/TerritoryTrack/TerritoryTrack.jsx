// src/components/TerritoryTrack/TerritoryTrack.jsx
// ============================================================
// Track horizontal « par territoire ». Section PINNÉE : au scroll, la piste se
// translate horizontalement à travers des panneaux plein écran qui rendent
// LES VRAIS COMPOSANTS signatures en mode `embed` (SVG strictement identiques),
// tous pilotés par UN filtre territoire commun (onglets sous-région + chips).
// Quand le dernier panneau est passé, le scroll vertical reprend.
//
// Pour ajouter une signature : l'importer, lui donner le mode `embed`/`code`
// (comme WaterGlass/TbBacilli/EnergyCell) et l'ajouter au tableau PANELS.
// prefers-reduced-motion / mobile : pas de pin, panneaux empilés.
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
import { getLenis } from "../SmoothScroll/SmoothScroll";
import WaterGlass from "../WaterGlass/WaterGlass";
import TbBacilli from "../TbBacilli/TbBacilli";
import EnergyCell from "../EnergyCell/EnergyCell";
import BiodiversityReef from "../BiodiversityReef/BiodiversityReef";
import ForestCover from "../ForestCover/ForestCover";
import CoastlineShift from "../CoastlineShift/CoastlineShift";
import PlantGrowth from "../PlantGrowth/PlantGrowth";
import CattleThrive from "../CattleThrive/CattleThrive";
import SkyRain from "../SkyRain/SkyRain";
import SmokePlume from "../SmokePlume/SmokePlume";
import SeaWarm from "../SeaWarm/SeaWarm";
import StiltHouse from "../StiltHouse/StiltHouse";
import CrowdAffected from "../CrowdAffected/CrowdAffected";
import LossStack from "../LossStack/LossStack";
import TourismBeach from "../TourismBeach/TourismBeach";
import PopGrowth from "../PopGrowth/PopGrowth";
import PowerMix from "../PowerMix/PowerMix";
import "./TerritoryTrack.scss";

gsap.registerPlugin(ScrollTrigger);

const SUBREGIONS = {
  melanesia: ["FJ", "PG", "SB", "VU", "NC"],
  polynesia: ["PF", "WS", "TO", "TV", "CK", "NU", "WF", "TK", "AS", "PN"],
  micronesia: ["FM", "GU", "MP", "MH", "NR", "PW", "KI"],
};
const REGION_OF = {};
Object.entries(SUBREGIONS).forEach(([k, arr]) =>
  arr.forEach((c) => {
    REGION_OF[c] = k;
  }),
);
const REGION_TABS = ["all", "melanesia", "polynesia", "micronesia"];

export default function TerritoryTrack() {
  const dispatch = useDispatch();
  const { t, lang } = useLang();
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // L'eau sert de liste canonique de territoires pour le filtre commun.
  const water = useSelector(selectDataset("water"));
  useEffect(() => {
    dispatch(loadDataset("water"));
  }, [dispatch]);

  const territories = useMemo(() => {
    if (water.status !== "succeeded" || !water.data) return [];
    return Object.keys(water.data.byArea)
      .filter((c) => isPict(c))
      .map((c) => ({ code: c, name: pictName(c, lang) }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [water, lang]);

  const ready = territories.length > 0;

  const [region, setRegion] = useState("all");
  const [code, setCode] = useState(null);
  useEffect(() => {
    if (territories.length && (!code || !territories.some((o) => o.code === code)))
      setCode(territories[0].code);
  }, [territories, code]);

  const selectRegion = (key) => setRegion(key);
  const visibleList = useMemo(
    () =>
      region === "all"
        ? territories
        : territories.filter((o) => REGION_OF[o.code] === region),
    [territories, region],
  );

  const current = territories.find((o) => o.code === code) || null;

  // Panneaux = vrais composants signatures (mode embed). Ajoutez-en ici.
  const PANELS = [
    { idx: "01", titleKey: "home.water.title", Comp: WaterGlass },
    { idx: "02", titleKey: "home.tb.title", Comp: TbBacilli },
    { idx: "03", titleKey: "home.energy.title", Comp: EnergyCell },
    { idx: "04", titleKey: "home.biodiv.title", Comp: BiodiversityReef },
    { idx: "05", titleKey: "home.forest.title", Comp: ForestCover },
    { idx: "06", titleKey: "home.coast.title", Comp: CoastlineShift },
    { idx: "07", titleKey: "home.plant.title", Comp: PlantGrowth },
    { idx: "08", titleKey: "home.cattle.title", Comp: CattleThrive },
    { idx: "09", titleKey: "home.sky.title", Comp: SkyRain },
    { idx: "10", titleKey: "home.smoke.title", Comp: SmokePlume },
    { idx: "11", titleKey: "home.sea.title", Comp: SeaWarm },
    { idx: "12", titleKey: "home.stilt.title", Comp: StiltHouse },
    { idx: "13", titleKey: "home.crowd.title", Comp: CrowdAffected },
    { idx: "14", titleKey: "home.loss.title", Comp: LossStack },
    { idx: "15", titleKey: "home.tourism.title", Comp: TourismBeach },
    { idx: "16", titleKey: "home.pop.title", Comp: PopGrowth },
    { idx: "17", titleKey: "home.power.title", Comp: PowerMix },
  ];

  /* ----- Pin + translation horizontale ----- */
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const panelsRef = useRef([]);
  const chipsRef = useRef(null);
  const [reveal, setReveal] = useState(false);

  const scrollChips = (dir) => {
    const el = chipsRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * Math.min(el.clientWidth * 0.7, 360),
      behavior: "smooth",
    });
  };

  useLayoutEffect(() => {
    if (!ready || reduced) return undefined;
    if (window.matchMedia && window.matchMedia("(max-width: 900px)").matches)
      return undefined;
    const sectionEl = sectionRef.current;
    const trackEl = trackRef.current;
    if (!sectionEl || !trackEl) return undefined;

    const ctx = gsap.context(() => {
      const distance = () => trackEl.scrollWidth - window.innerWidth;
      gsap.to(trackEl, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: sectionEl,
          start: "top top",
          end: () => "+=" + distance(),
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
    }, sectionEl);

    const refresh = () => ScrollTrigger.refresh();
    refresh();
    window.addEventListener("load", refresh);
    return () => {
      window.removeEventListener("load", refresh);
      ctx.revert();
    };
  }, [ready, reduced]);

  /* ----- Révélation cinématique : chaque panneau s'anime quand il arrive
     au centre. Fallback sûr : la classe `ttrack--reveal` n'est posée que
     si l'observer s'installe, sinon le contenu reste visible. ----- */
  useEffect(() => {
    if (!ready || reduced) return undefined;
    const els = panelsRef.current.filter(Boolean);
    if (!els.length || typeof IntersectionObserver === "undefined")
      return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            e.target.classList.add("is-active");
          }
        });
      },
      { threshold: [0, 0.5, 1] },
    );
    els.forEach((el) => io.observe(el));
    setReveal(true);
    return () => {
      io.disconnect();
      setReveal(false);
    };
  }, [ready, reduced]);

  /* ----- IMMERSION LENIS : la vitesse de scroll incline légèrement le
     contenu (effet "speed = skew" des sites primés) et fait dériver
     l'index fantôme (parallaxe de profondeur). Lissé, retour à 0 au repos. ----- */
  useEffect(() => {
    if (reduced) return undefined;
    const sectionEl = sectionRef.current;
    const trackEl = trackRef.current;
    if (!sectionEl || !trackEl) return undefined;

    let skew = 0;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const tick = () => {
      const lenis = getLenis();
      const v = lenis && typeof lenis.velocity === "number" ? lenis.velocity : 0;
      const target = clamp(v * 0.18, -5, 5); // degrés
      skew += (target - skew) * 0.08; // lissage
      if (Math.abs(skew) < 0.001) skew = 0;
      trackEl.style.setProperty("--vskew", skew.toFixed(3) + "deg");
      sectionEl.style.setProperty("--vshift", (skew * 5).toFixed(2) + "px");
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      trackEl.style.removeProperty("--vskew");
      sectionEl.style.removeProperty("--vshift");
    };
  }, [ready, reduced]);

  return (
    <section
      className={`ttrack ${reveal ? "ttrack--reveal" : ""}`}
      ref={sectionRef}
    >
      <div className="ttrack__viewport">
        {/* Filtre territoire commun (reste fixe pendant le défilement) */}
        <div className="ttrack__bar">
          <div className="ttrack__bar-head">
            <p className="ttrack__kicker">{t("home.track.kicker")}</p>
            <p className="ttrack__name">
              {current && (
                <img
                  className="ttrack__name-flag"
                  src={flagUrl(current.code)}
                  alt=""
                  aria-hidden="true"
                />
              )}
              {current ? current.name : ""}
            </p>
          </div>

          <div className="ttrack__filters">
            <div className="ttrack__regions" role="tablist">
              {REGION_TABS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={region === r}
                  className={`ttrack__region ${region === r ? "is-on" : ""}`}
                  onClick={() => selectRegion(r)}
                >
                  {t(`home.track.region_${r}`)}
                </button>
              ))}
            </div>
            <div className="ttrack__chipsnav">
              <button
                type="button"
                className="ttrack__arrow"
                onClick={() => scrollChips(-1)}
                aria-label={t("home.track.prev")}
              >
                <span aria-hidden="true">‹</span>
              </button>
              <div className="ttrack__chips" ref={chipsRef} data-lenis-prevent>
                {visibleList.map((o) => (
                  <button
                    key={o.code}
                    type="button"
                    className={`ttrack__chip ${code === o.code ? "is-on" : ""}`}
                    aria-pressed={code === o.code}
                    onClick={() => setCode(o.code)}
                  >
                    <img
                      className="ttrack__chip-flag"
                      src={flagUrl(o.code)}
                      alt=""
                      aria-hidden="true"
                    />
                    <span className="ttrack__chip-name">{o.name}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ttrack__arrow"
                onClick={() => scrollChips(1)}
                aria-label={t("home.track.next")}
              >
                <span aria-hidden="true">›</span>
              </button>
            </div>
          </div>

          <p className="ttrack__hint" aria-hidden="true">
            {t("home.track.hint")}
          </p>
        </div>

        {!ready ? (
          <p className="ttrack__state">{t("home.track.loading")}</p>
        ) : (
          <div className="ttrack__track" ref={trackRef}>
            {PANELS.map(({ idx, titleKey, Comp }, i) => (
              <article
                className="ttrack__panel"
                key={idx}
                ref={(el) => (panelsRef.current[i] = el)}
              >
                <span className="ttrack__panel-ghost" aria-hidden="true">
                  {idx}
                </span>
                <div className="ttrack__panel-in">
                  <header className="ttrack__panel-head">
                    <h3 className="ttrack__panel-title">
                      {t(titleKey)
                        .split(" ")
                        .map((w, wi) => (
                          <span className="ttrack__word" key={wi}>
                            <span className="ttrack__word-in">{w}</span>
                          </span>
                        ))}
                    </h3>
                  </header>
                  <div className="ttrack__panel-body">
                    <Comp embed code={code} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}