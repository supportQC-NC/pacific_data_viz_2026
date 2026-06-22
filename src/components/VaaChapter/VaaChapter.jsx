// src/components/VaaChapter/VaaChapter.jsx
// ============================================================
// COQUILLE DE CHAPITRE — VA'A (A).
//  • HERO plein écran (image de fond) : présente le chapitre ; au scroll on
//    découvre le voyage.
//  • Voyage : pour CHAQUE pays, tous les indicateurs ENSEMBLE, avec badge
//    tendance (hausse/baisse) et « Donnée indisponible » si absent.
//  • Carte satellite à gauche (pirogue centrée qui recentre/zoome).
// indicators = [{ render:(code)=>JSX, labelKey, available:Set, trend:(code)=>'up'|'down'|'flat'|null }]
// ============================================================

import React from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiArrowDown } from "react-icons/fi";
import { useLang } from "../../store/context/langContext";
import useVaaScroll from "../../hooks/useVaaScroll";
import VaaMap from "../VaaMap/VaaMap";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";
import { VAA_ROUTE } from "../../data/vaaRoute";
import "./VaaChapter.scss";

export default function VaaChapter({
  accent = "humain",
  heroImage,
  eyebrowKey,
  titleKey,
  ledeKey,
  problemKey,
  messageKey,
  questionKey,
  route,
  indicators = [],
  coda = [],
}) {
  const { t } = useLang();
  const { ref, progress, index, code } = useVaaScroll({ route });
  const total = route && route.length ? route.length : VAA_ROUTE.length;

  return (
    <div className={`vaa vaa--${accent}`}>
      <header
        className="vaa__hero"
        style={heroImage ? { "--vaa-hero": `url(${heroImage})` } : undefined}
      >
        <div className="vaa__hero-bg" aria-hidden="true" />
        <div className="vaa__hero-inner">
          <Link to="/" className="vaa__back">
            <FiArrowLeft aria-hidden="true" />
            <span>{t("chapters.back")}</span>
          </Link>
          <p className="vaa__eyebrow">{t(eyebrowKey)}</p>
          <h1 className="vaa__title">{t(titleKey)}</h1>
          <p className="vaa__lede">{t(ledeKey)}</p>

          {problemKey && (
            <aside className="vaa__problem">
              <span className="vaa__problem-tag">{t("vaa.problem_tag")}</span>
              <p className="vaa__problem-text">{t(problemKey)}</p>
            </aside>
          )}

          <span className="vaa__cue">
            <FiArrowDown aria-hidden="true" />
            {t("vaa.scroll_hint")}
          </span>
        </div>
      </header>

      <section
        className="vaa__voyage"
        ref={ref}
        style={{ "--vaa-steps": total, "--vaa-p": progress }}
      >
        <div className="vaa__pin">
          <div className="vaa__stage">
            {messageKey && <p className="vaa__message">{t(messageKey)}</p>}

            <div className="vaa__cols">
              <aside className="vaa__aside">
                <VaaMap code={code} index={index} route={route} />
                <p className="vaa__counter">
                  <span className="vaa__step">{String(Math.min(index + 1, total)).padStart(2, "0")}</span>
                  {" "}/ {total}
                </p>
                <div className="vaa__rail" aria-hidden="true">
                  <span className="vaa__rail-fill" />
                </div>
              </aside>

              <div className="vaa__scene">
                {questionKey && <p className="vaa__question">{t(questionKey)}</p>}

                <div className="vaa__indicators">
                  {indicators.map((ind, i) => {
                    const ok = ind.available ? ind.available.has(code) : true;
                    const tr = ok && ind.trend ? ind.trend(code) : null;
                    const tone = tr
                      ? tr === "flat"
                        ? "flat"
                        : tr === ind.goodWhen
                          ? "good"
                          : "bad"
                      : null;
                    return (
                      <article className="vaa__ind" key={i}>
                        <div className="vaa__ind-head">
                          <h3 className="vaa__ind-label">{t(ind.labelKey)}</h3>
                          {tr && (
                            <span className={`vaa__trend vaa__trend--${tone}`}>
                              {t(`vaa.trend.${tr}`)}
                            </span>
                          )}
                        </div>
                        {ok ? (
                          <ErrorBoundary
                            fallback={<p className="vaa__ind-empty">{t("vaa.error")}</p>}
                          >
                            {ind.render(code)}
                          </ErrorBoundary>
                        ) : (
                          <p className="vaa__ind-empty">{t("vaa.unavailable")}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {coda.length > 0 && (
        <section className="vaa__coda">
          <h2 className="vaa__coda-title">{t("vaa.coda_title")}</h2>
          <div className="vaa__coda-grid">
            {coda.map((C, i) => (
              <ErrorBoundary key={i} fallback={null}>
                <C />
              </ErrorBoundary>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}