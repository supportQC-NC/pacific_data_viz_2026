// src/components/ActBoard/ActBoard.jsx
// ============================================================
// Coquille « dashboard narratif » réutilisable. Un acte se parcourt en
// TROIS temps, sans ancres ni scroll : une section à la fois.
//   0) INTRO  — titre + thèse + chiffres-chocs, plein écran.
//   1) BOARD  — RAIL de filtres + sélecteur de graphes à GAUCHE (vertical,
//               gagne de la hauteur), GRAPHE plein cadre à droite (borné à
//               l'écran), ligne « à retenir » dessous.
//   2) OUTRO  — la conclusion / transition.
// Dans le board, ←/→ changent de GRAPHE ; les boutons changent d'ÉTAPE.
// 100 % présentational : l'acte calcule tout et passe les props.
// ============================================================

import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import KpiRow from "../KpiRow/KpiRow";
import Loader from "../Loader/Loader";
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
    (i) => setTab((prev) => Math.max(0, Math.min(count - 1, typeof i === "function" ? i(prev) : i))),
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
  const progressTxt = progress ? `${progress.index} / ${progress.total}` : null;

  return (
    <main className={`board board--s${step}`}>
      <div className="container">
        {/* ---------- ÉTAPE 0 — INTRO plein écran ---------- */}
        {step === 0 && (
          <section className="board__intro">
            <div className="board__intro-inner">
              <div className="board__hero-top">
                <p className="eyebrow">{eyebrow}</p>
                {progressTxt ? <span className="board__progress">{progressTxt}</span> : null}
              </div>
              {title ? <h1 className="board__title board__title--xl">{title}</h1> : null}
              {thesis ? <p className="board__thesis board__thesis--xl">{thesis}</p> : null}
              {kpis.length > 0 ? <KpiRow items={kpis} title={kpiTitle} /> : null}

              {status === "loading" && <Loader compact label={labels.loading} />}
              {status === "error" && (
                <div className="board__state board__state--err">
                  <span>{labels.error}</span>
                  {onRetry ? (
                    <button type="button" className="board__retry" onClick={onRetry}>
                      {labels.retry}
                    </button>
                  ) : null}
                </div>
              )}
              {status === "empty" && <p className="board__state">{labels.empty}</p>}

              {status === "ready" && count > 0 ? (
                <div className="board__intro-actions">
                  <button type="button" className="board__cta" onClick={() => goStep(1)}>
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
              <div className="board__crumb">
                <span className="board__crumb-title">{title}</span>
                {progressTxt ? <span className="board__progress">{progressTxt}</span> : null}
              </div>

              <div className="board__work">
                <aside className="board__rail">
                  <div className="board__rail-filters">{filters}</div>

                  <nav className="board__navlist" role="tablist" aria-label={labels.signature}>
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
                          <span className="board__navitem-star" aria-hidden="true">
                            ★
                          </span>
                        ) : null}
                        <span className="board__navitem-label">{c.tab}</span>
                      </button>
                    ))}
                  </nav>

                  <div className="board__rail-steps">
                    <button type="button" className="board__btn board__btn--ghost" onClick={() => goStep(0)}>
                      <span aria-hidden="true">←</span> {labels.backIntro}
                    </button>
                    {outro ? (
                      <button type="button" className="board__btn board__btn--primary" onClick={() => goStep(2)}>
                        {labels.conclusion} <span aria-hidden="true">→</span>
                      </button>
                    ) : null}
                  </div>
                </aside>

                <div className="board__main">
                  <div className="board__head">
                    <span className="board__num">
                      {String(idx + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
                      {active.signature && labels.signature ? ` · ${labels.signature}` : ""}
                    </span>
                    {active.title ? <h2 className="board__chart-title">{active.title}</h2> : null}
                    {active.finding ? <p className="board__finding">{active.finding}</p> : null}
                  </div>

                  <div className="board__chart">{active.node}</div>

                  {active.takeaway ? (
                    <p className="board__takeaway">
                      {labels.takeawayKicker ? <span className="board__takeaway-k">{labels.takeawayKicker}</span> : null}
                      {active.takeaway}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : (
            <Loader fullscreen label={labels.loading} />
          ))}

        {/* ---------- ÉTAPE 2 — OUTRO plein écran ---------- */}
        {step === 2 && outro && (
          <section className="board__outro">
            <div className="board__outro-inner">
              <p className="eyebrow">{outro.kicker}</p>
              <h2 className="board__outro-title">{outro.title}</h2>
              <p className="board__outro-text">{outro.text}</p>
              <div className="board__actions">
                {outro.primary ? (
                  <Link to={outro.primary.to} className="board__btn board__btn--primary">
                    {outro.primary.label} <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
                {outro.secondary ? (
                  <Link to={outro.secondary.to} className="board__btn">
                    {outro.secondary.label}
                  </Link>
                ) : null}
              </div>
              <button type="button" className="board__revise" onClick={() => goStep(1)}>
                <span aria-hidden="true">←</span> {labels.reviseData}
              </button>
            </div>
          </section>
        )}

        {back ? (
          <Link to={back.to} className="board__back">
            ← {back.label}
          </Link>
        ) : null}
      </div>
    </main>
  );
}