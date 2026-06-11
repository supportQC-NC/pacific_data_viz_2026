// src/components/ActBoard/ActBoard.jsx
// ============================================================
// Coquille « dashboard narratif » réutilisable. Un acte se parcourt en
// TROIS temps : intro (plein écran) → board → outro.
//
// La <ActBar> sticky (préc · TITRE de l'acte + progression · suiv) est montée
// sur les étapes BOARD et OUTRO et porte désormais l'IDENTITÉ de l'acte :
//   • plus de fil d'Ariane interne (titre + n/total) dans le board ;
//   • plus de boutons d'étape dans le rail ;
//   • plus de lien « retour à l'accueil » sous le panneau.
// Résultat : le board gagne de la hauteur et tient en plein écran.
//
// NB : sans boutons d'étape, l'écran de conclusion (step 2) n'est plus
// déclenché depuis le board ; il reste rendu (réactivable en un point).
// NUMÉROTATION & NAVIGATION dérivées du PARCOURS (journeyContext).
// ============================================================

import React, { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import KpiRow from "../KpiRow/KpiRow";
import Loader from "../Loader/Loader";
import ActBar from "../ActBar/ActBar";
import "./ActBoard.scss";

export default function ActBoard({
  status = "ready",
  labels = {},
  onRetry,
  back,
  eyebrow,
  title,
  thesis,
  kpis = [],
  kpiTitle,
  filters,
  charts = [],
  progress,
  outro,
}) {
  const { t } = useLang();
  const { pathname } = useLocation();
  const { byPath, journey } = useJourney();

  // Résolution de l'acte courant via la route → numéro, total, voisins.
  const here = byPath(pathname);
  const num = here ? String(here.number).padStart(2, "0") : null;
  const actName = here ? t(`home.acts.${here.id}_name`) : "";

  // Eyebrow « Acte 03 — Nom » dérivé du parcours ; repli sur la prop.
  // (Utilisé uniquement par l'intro plein écran, étape 0.)
  const eyebrowTxt = here
    ? `${t("flow.act")} ${num}${actName ? ` — ${actName}` : ""}`
    : eyebrow;

  // Progression dérivée ; repli sur la prop.
  const effProgress = here ? { index: here.number, total: here.total } : progress;

  // --- Voisins du parcours (pour la barre d'acte persistante) ---------------
  let nextAct = null;
  if (here && journey && here.index + 1 < journey.length) {
    const n = journey[here.index + 1];
    nextAct = {
      to: n.to,
      label: `${t("flow.next")} · ${t(`home.acts.${n.id}_title`)}`,
    };
  }
  let prevAct = null;
  if (here && journey && here.index - 1 >= 0) {
    const p = journey[here.index - 1];
    prevAct = {
      to: p.to,
      label: `${t("flow.prev")} · ${t(`home.acts.${p.id}_title`)}`,
    };
  }

  // CTA « suivant » de l'OUTRO (repli outro.primary si hors parcours/dernier).
  let nextPrimary = outro ? outro.primary : null;
  if (nextAct) nextPrimary = nextAct;

  const count = charts.length;
  const [tab, setTab] = useState(() => {
    const sig = charts.findIndex((c) => c.signature);
    return sig >= 0 ? sig : 0;
  });
  const [step, setStep] = useState(0); // 0 intro · 1 board · 2 outro

  useEffect(() => {
    setTab((i) => (i > count - 1 ? Math.max(0, count - 1) : i));
  }, [count]);

  const goTab = useCallback(
    (i) =>
      setTab((prev) =>
        Math.max(0, Math.min(count - 1, typeof i === "function" ? i(prev) : i)),
      ),
    [count],
  );
  const goStep = useCallback((s) => setStep(Math.max(0, Math.min(2, s))), []);

  useEffect(() => {
    if (status !== "ready" || step !== 1) return undefined;
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goTab((p) => p + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTab((p) => p - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, step, goTab]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const idx = Math.min(tab, Math.max(0, count - 1));
  const active = count ? charts[idx] : null;
  const progressTxt = effProgress
    ? `${effProgress.index} / ${effProgress.total}`
    : null;

  // La barre d'acte est présente sur le board (1) et l'outro (2), pas sur
  // l'ouvre-chapitre (0) pour préserver la révélation cinématique.
  const showActBar = step === 1 || step === 2;

  return (
    <main className={`board board--s${step}`}>
      {/* ---------- Barre d'acte persistante (préc · titre+progression · suiv) ---------- */}
      {showActBar && (
        <ActBar
          prev={prevAct}
          next={nextAct}
          title={title}
          index={effProgress ? effProgress.index : undefined}
          total={effProgress ? effProgress.total : undefined}
          navAria={t("flow.nav_aria")}
          progressAria={t("flow.progress_aria")}
        />
      )}

      <div className="container">
        {/* ---------- ÉTAPE 0 — INTRO plein écran ---------- */}
        {step === 0 && (
          <section className="board__intro">
            <div className="board__intro-inner">
              <div className="board__hero-top">
                <p className="eyebrow">{eyebrowTxt}</p>
                {progressTxt ? (
                  <span className="board__progress">{progressTxt}</span>
                ) : null}
              </div>
              {title ? (
                <h1 className="board__title board__title--xl">{title}</h1>
              ) : null}
              {thesis ? (
                <p className="board__thesis board__thesis--xl">{thesis}</p>
              ) : null}
              {kpis.length > 0 ? <KpiRow items={kpis} title={kpiTitle} /> : null}

              {status === "loading" && (
                <Loader compact label={labels.loading} />
              )}
              {status === "error" && (
                <div className="board__state board__state--err">
                  <span>{labels.error}</span>
                  {onRetry ? (
                    <button
                      type="button"
                      className="board__retry"
                      onClick={onRetry}
                    >
                      {labels.retry}
                    </button>
                  ) : null}
                </div>
              )}
              {status === "empty" && (
                <p className="board__state">{labels.empty}</p>
              )}

              {status === "ready" && count > 0 ? (
                <div className="board__intro-actions">
                  <button
                    type="button"
                    className="board__cta"
                    onClick={() => goStep(1)}
                  >
                    {labels.start} <span aria-hidden="true">→</span>
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        )}

        {/* ---------- ÉTAPE 1 — BOARD (rail + graphe) ---------- */}
        {step === 1 &&
          (status === "ready" && active ? (
            <section className="board__panel">
              <div className="board__work">
                <aside className="board__rail">
                  <div className="board__rail-filters">{filters}</div>

                  <nav
                    className="board__navlist"
                    role="tablist"
                    aria-label={labels.signature}
                  >
                    {charts.map((c, i) => (
                      <button
                        key={c.id}
                        type="button"
                        role="tab"
                        aria-selected={i === idx}
                        className={`board__navitem ${i === idx ? "is-active" : ""} ${c.signature ? "is-signature" : ""}`}
                        onClick={() => goTab(i)}
                      >
                        {c.signature ? (
                          <span
                            className="board__navitem-star"
                            aria-hidden="true"
                          >
                            ★
                          </span>
                        ) : null}
                        <span className="board__navitem-label">{c.tab}</span>
                      </button>
                    ))}
                  </nav>
                </aside>

                <div className="board__main">
                  <div className="board__head">
                    <span className="board__num">
                      {String(idx + 1).padStart(2, "0")} /{" "}
                      {String(count).padStart(2, "0")}
                      {active.signature && labels.signature
                        ? ` · ${labels.signature}`
                        : ""}
                    </span>
                    {active.title ? (
                      <h2 className="board__chart-title">{active.title}</h2>
                    ) : null}
                    {active.finding ? (
                      <p className="board__finding">{active.finding}</p>
                    ) : null}
                  </div>

                  {active.empty ? (
                    <div className="board__chart-empty">{labels.empty}</div>
                  ) : (
                    <div className="board__chart">{active.node}</div>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <Loader fullscreen label={labels.loading} />
          ))}

        {/* ---------- ÉTAPE 2 — OUTRO plein écran (conservé, réactivable) ---------- */}
        {step === 2 && outro && (
          <section className="board__outro">
            <div className="board__outro-inner">
              <p className="eyebrow">{outro.kicker}</p>
              <h2 className="board__outro-title">{outro.title}</h2>
              <p className="board__outro-text">{outro.text}</p>
              <div className="board__actions">
                {nextPrimary ? (
                  <Link
                    to={nextPrimary.to}
                    className="board__btn board__btn--primary"
                  >
                    {nextPrimary.label} <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
                {outro.secondary ? (
                  <Link to={outro.secondary.to} className="board__btn">
                    {outro.secondary.label}
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                className="board__revise"
                onClick={() => goStep(1)}
              >
                <span aria-hidden="true">←</span> {labels.reviseData}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}