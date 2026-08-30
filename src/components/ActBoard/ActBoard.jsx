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
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { useLang } from "../../store/context/langContext";
import { useJourney } from "../../store/context/journeyContext";
import KpiRow from "../KpiRow/KpiRow";
import KeyFigures from "../KeyFigures/KeyFigures";
import Loader from "../Loader/Loader";
import ActBar from "../ActBar/ActBar";
import ChartCarousel from "../ChartCarousel/ChartCarousel";
import EscaleBar from "../EscaleBar/EscaleBar";
import ChartKey from "../ChartKey/ChartKey";
import ChartHint from "../ChartHint/ChartHint";
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
  // CHIFFRES-CLÉS DE LA COLONNE, distincts des `kpis` du hero : deux ou trois
  // seulement, et formulés pour être lus à 230 px de large. Une escale qui n'en
  // fournit pas retombe sur ses `kpis`, dont le format est compatible.
  figures = [],
  kpiTitle,
  filters,
  charts = [],
  progress,
  outro,
  nav = "rail",
  initialTab,
  // --- Disposition « focus » (opt-in, cf. ActBoard.scss) -----------------
  // Rend la QUESTION de l'acte visible dans le board et redonne au
  // graphique la hauteur qu'il n'avait plus : mesuré avant refonte, la
  // donnée n'occupait que 460 px sur 959, soit 48 % de l'écran — le reste
  // partait en chrome (KPI, filtres, onglets, barre d'acte).
  // Opt-in acte par acte : les actes qui ne la passent pas ne bougent pas.
  focus = false,
}) {
  const { t, lang } = useLang();
  // Repli i18n : si la clé n'existe pas encore, on affiche un libellé lisible.
  const tf = (key, fr, en) => {
    const v = t(key);
    return v && v !== key ? v : lang === "en" ? en : fr;
  };
  const { pathname } = useLocation();
  const { byPath, journey, guided, exitJourney } = useJourney();

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
      // `label` est le NOM DU BOUTON, `hint` le titre de l'escale visée. Le
      // second se lit au survol ; le premier doit tenir sur le bouton et dire
      // ce qu'il fait, pas où il mène.
      label: t("flow.next"),
      hint: t(`home.acts.${n.id}_title`),
    };
  }
  let prevAct = null;
  if (here && journey && here.index - 1 >= 0) {
    const p = journey[here.index - 1];
    prevAct = {
      to: p.to,
      label: t("flow.prev"),
      hint: t(`home.acts.${p.id}_title`),
    };
  }

  // CTA « suivant » de l'OUTRO (repli outro.primary si hors parcours/dernier).
  let nextPrimary = outro ? outro.primary : null;
  if (nextAct) nextPrimary = nextAct;

  // Les graphiques « Données & couverture » (méta : fiche du jeu, matrice de
  // couverture) sont sortis du carrousel et regroupés derrière un bouton ⓘ.
  const INFO_IDS = ["read", "coverage", "source", "data", "method"];
  // LA CARTE FERME TOUJOURS LA NAVIGATION.
  // Elle situe, elle ne démontre pas : on l'a vue trois fois se retrouver au
  // milieu du carrousel simplement parce que c'est là qu'elle avait été
  // écrite dans le tableau. La règle est donc portée par le gabarit et non
  // recopiée dans chaque escale — une vue ajoutée plus tard ne pourra plus la
  // repousser par mégarde.
  //
  // Seul l'identifiant exact `map` est concerné : les escales qui portent
  // plusieurs cartes (le trait de côte, par exemple) gardent les leurs à leur
  // place dans le récit.
  //
  // EXCEPTION — la carte SIGNATURE ne se déplace pas. Sur l'escale des
  // cyclones, la carte n'est pas un repère géographique posé après coup :
  // c'est le graphique qui porte la démonstration, les trajectoires animées
  // saison par saison. Une escale qui déclare sa carte comme signature dit
  // qu'elle ouvre le récit, et le gabarit la laisse là où elle est.
  const mapMovesLast = (c) => c.id === "map" && !c.signature;
  const mainCharts = charts
    .filter((c) => !INFO_IDS.includes(c.id))
    .sort((a, b) => (mapMovesLast(a) ? 1 : 0) - (mapMovesLast(b) ? 1 : 0));
  const infoCharts = charts.filter((c) => INFO_IDS.includes(c.id));
  const hasInfo = infoCharts.length > 0;

  const count = mainCharts.length;
  const [tab, setTab] = useState(() => {
    if (initialTab != null) {
      const byId = mainCharts.findIndex((c) => c.id === initialTab);
      if (byId >= 0) return byId;
      if (typeof initialTab === "number" && initialTab >= 0 && initialTab < mainCharts.length) {
        return initialTab;
      }
    }
    const sig = mainCharts.findIndex((c) => c.signature);
    return sig >= 0 ? sig : 0;
  });
  // 0 intro · 1 board · 2 outro
  //
  // EN MODE VOYAGE GUIDÉ, l'étape 0 n'est plus une porte narrative : la
  // traversée en pirogue (ActFlow) joue ce rôle. On entre donc directement
  // dans le board dès que les données sont exploitables, pour éviter DEUX
  // écrans d'accueil successifs avant la donnée.
  //
  // L'étape 0 reste indispensable dans tous les autres cas : c'est elle qui
  // porte le loader, l'état d'erreur avec `onRetry`, l'état vide, et la garde
  // qui empêche d'ouvrir un board sans graphique. On ne la saute donc QUE si
  // `status === "ready" && count > 0`.
  const skipIntro = guided && status === "ready" && count > 0;
  const [step, setStep] = useState(skipIntro ? 1 : 0);
  const [infoOpen, setInfoOpen] = useState(false);
  // Modale « comment lire ce graphique ». Elle remplace un dépliant posé
  // sous le tracé : replié il ne disait rien, déplié il poussait le
  // graphique hors de l'écran. Un bouton « + » discret, une fiche complète
  // à la demande.
  const [readOpen, setReadOpen] = useState(false);
  const [infoTab, setInfoTab] = useState(0);
  const infoActive = hasInfo
    ? infoCharts[Math.min(infoTab, infoCharts.length - 1)]
    : null;

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
        // Au-delà du dernier graphique, on enchaîne sur la CONCLUSION de
        // l'acte (étape 2) au lieu de rester bloqué : c'est le troisième
        // temps prévu par la coquille (intro → board → outro).
        // (`tab`/`count` et non `idx`, déclaré plus bas : le tableau de
        // dépendances est évalué pendant le rendu, donc avant `idx`.)
        if (outro && tab >= count - 1) goStep(2);
        else goTab((p) => p + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTab((p) => p - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, step, goTab, goStep, outro, tab, count]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Les données arrivent souvent APRÈS le montage : à ce moment `skipIntro`
  // était encore faux et l'étape 0 s'est affichée (loader). Dès qu'elles sont
  // exploitables, on enchaîne sur le board — le voyage n'a qu'une porte.
  // Uniquement 0 → 1 : on ne ramène jamais l'utilisateur depuis l'outro (2).
  useEffect(() => {
    if (skipIntro && step === 0) setStep(1);
  }, [skipIntro, step]);

  useEffect(() => {
    if (!infoOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setInfoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [infoOpen]);

  useEffect(() => {
    if (!readOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setReadOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOpen]);

  // On referme en changeant de vue : la fiche décrit le graphique affiché.
  // On observe `tab` et non `idx` — `idx` n'est calculé que plus bas, et un
  // tableau de dépendances est évalué pendant le rendu, donc avant lui.
  useEffect(() => {
    setReadOpen(false);
  }, [tab]);

  const idx = Math.min(tab, Math.max(0, count - 1));
  const active = count ? mainCharts[idx] : null;

  // Bouton « + » de la fiche de lecture. Défini ici parce qu'il est posé à
  // DEUX endroits selon la largeur : dans la colonne de lecture quand elle
  // existe (au-dessus de 1180 px, à côté du titre), et dans la tête du
  // graphique en dessous, où la colonne n'est pas rendue.
  const moreBtn =
    focus && active && (active.takeaway || active.legend || active.hint) ? (
      <button
        type="button"
        className="board__more"
        onClick={() => setReadOpen(true)}
        aria-haspopup="dialog"
        aria-label={tf("board.how_to_read", "Comment lire ce graphique", "How to read this chart")}
        title={tf("board.how_to_read", "Comment lire ce graphique", "How to read this chart")}
      >
        <span aria-hidden="true">+</span>
      </button>
    ) : null;
  const progressTxt = effProgress
    ? `${effProgress.index} / ${effProgress.total}`
    : null;

  // La barre d'acte est présente sur le board (1) et l'outro (2), pas sur
  // l'ouvre-chapitre (0) pour préserver la révélation cinématique.
  const showActBar = step === 1 || step === 2;

  return (
    <main
      className={`board board--s${step} ${nav === "carousel" ? "board--carousel" : ""} ${
        focus ? "board--focus" : ""
      }`}
    >
      {/* ---------- Barre d'acte persistante (préc · titre+progression · suiv) ---------- */}
      {showActBar && !focus && (
        <ActBar
          prev={prevAct}
          next={nextAct}
          title={title}
          index={effProgress ? effProgress.index : undefined}
          total={effProgress ? effProgress.total : undefined}
          navAria={t("flow.nav_aria")}
          progressAria={t("flow.progress_aria")}
          // Sortie du voyage : uniquement en mode guidé, sinon la barre reste
          // strictement identique à ce qu'elle était.
          onExit={guided ? exitJourney : null}
          exitLabel={guided ? tf("flow.exit_voyage", "Quitter le voyage", "Leave the voyage") : ""}
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
              {/* CHIFFRES-CLÉS — rendus ici aussi, car en mode voyage guidé
                  l'étape 0 est sautée : sans cela les KPI disparaîtraient
                  complètement du parcours. Hors voyage, ils restent affichés
                  à l'étape 0 comme avant ; on ne les montre donc ici que
                  lorsque l'intro a été court-circuitée. */}
              {/* ---------- BANDE DE TÊTE ----------
                  La QUESTION de l'acte n'est plus posée ici : elle est
                  portée par la traversée en pirogue qui précède le
                  dashboard, où elle a la place et le temps d'être lue.
                  Le board s'ouvre donc directement sur la donnée — et
                  n'affiche cette bande que si l'acte lui confie des
                  chiffres-clés. Sans eux, elle disparaît complètement et
                  toute sa hauteur revient au graphique.

                  `thesis` continue d'être rendue à l'étape 0 (hors voyage
                  guidé), où elle reste l'amorce de l'acte. */}
              {focus ? (
                kpis.length > 0 ? (
                  <div className="board__ask">
                    <KpiRow items={kpis} title={kpiTitle} compact />
                  </div>
                ) : null
              ) : (
                skipIntro && kpis.length > 0 ? (
                  <KpiRow items={kpis} title={kpiTitle} />
                ) : null
              )}

              {/* UNE SEULE barre. Navigation entre ESCALES (chevrons,
                  titre, progression) et navigation entre VUES (onglets,
                  filtre, aide, données) partagent la même rangée. Avant,
                  ces deux niveaux occupaient deux bandes pleine largeur
                  superposées : deux en-têtes concurrents avant le premier
                  chiffre, et une centaine de pixels pris au graphique. */}
              {focus && nav === "carousel" ? (
                <EscaleBar
                  prev={prevAct}
                  next={nextAct}
                  title={title}
                  index={effProgress ? effProgress.index : undefined}
                  total={effProgress ? effProgress.total : undefined}
                  navAria={t("flow.nav_aria")}
                  progressAria={t("flow.progress_aria")}
                  onExit={guided ? exitJourney : null}
                  exitLabel={
                    guided
                      ? tf("flow.exit_voyage", "Quitter le voyage", "Leave the voyage")
                      : ""
                  }
                >
                  <ChartCarousel
                    charts={mainCharts}
                    index={idx}
                    onSelect={goTab}
                    labels={{
                      prev: labels.prev,
                      next: labels.next,
                      signature: labels.signature,
                      group: labels.viewGroup,
                    }}
                  />
                  {filters ? (
                    <div className="board__bar-filters">{filters}</div>
                  ) : null}
                  {active && active.hint ? (
                    <ChartHint
                      text={active.hint}
                      keys={labels.switchHint}
                      label={tf("board.explore", "Comment explorer", "How to explore")}
                    />
                  ) : null}
                  {hasInfo && (
                    <button
                      type="button"
                      className="board__infobtn board__infobtn--bar"
                      onClick={() => setInfoOpen(true)}
                      aria-haspopup="dialog"
                      aria-label={tf("board.info_title", "Données & couverture", "Data & coverage")}
                      title={tf("board.info_title", "Données & couverture", "Data & coverage")}
                    >
                      <span aria-hidden="true">i</span>
                    </button>
                  )}
                </EscaleBar>
              ) : null}

              <div className="board__work">
                {hasInfo && !focus && (
                  <button
                    type="button"
                    className="board__infobtn"
                    onClick={() => setInfoOpen(true)}
                    aria-haspopup="dialog"
                    aria-label={tf("board.info_title", "Données & couverture", "Data & coverage")}
                    title={tf("board.info_title", "Données & couverture", "Data & coverage")}
                  >
                    <span aria-hidden="true">i</span>
                  </button>
                )}
                {!focus && (nav !== "carousel" || filters) && (
                <aside className="board__rail">
                  {filters ? <div className="board__rail-filters">{filters}</div> : null}

                  {nav !== "carousel" && (
                  <nav
                    className="board__navlist"
                    role="tablist"
                    aria-label={labels.signature}
                  >
                    {mainCharts.map((c, i) => (
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
                  )}
                </aside>
                )}

                <div className="board__main">
                  {!focus && nav === "carousel" && (
                    <ChartCarousel
                      charts={mainCharts}
                      index={idx}
                      onSelect={goTab}
                      labels={{ prev: labels.prev, next: labels.next, signature: labels.signature, group: labels.viewGroup }}
                    />
                  )}
                  {/* L'EN-TÊTE REVIENT SUR LES VUES `bare`, EN DESSOUS DE 1180 px.
                      `bare` donne au tracé le panneau entier — c'était sans
                      risque tant que la colonne de lecture portait le titre, la
                      phrase, la source et les commandes. Sous 1180 px cette
                      colonne n'existe pas : une vue `bare` y perdait TOUT, y
                      compris la provenance de ses données. Au-dessus, la règle
                      CSS `.board--focus .board__head { display:none }` continue
                      de l'effacer : le rendu desktop est inchangé. */}
                  {(
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
                      {/* Les chiffres suivent le lecteur sous 1180 px aussi :
                          la colonne disparaît, eux non. Ils s'y mettent en
                          ligne — la largeur est disponible, la hauteur non. */}
                      {(figures.length ? figures : kpis).length ? (
                        <KeyFigures
                          items={figures.length ? figures : kpis}
                          label={tf("board.key_figures", "Chiffres-clés", "Key figures")}
                        />
                      ) : null}
                      {/* LES COMMANDES DE LA VUE, EN REPLI.
                          Elles vivent dans la colonne de lecture — mais celle-ci
                          disparaît sous 1180 px, où elle volerait au graphique
                          la largeur qu'elle prétend rentabiliser. Sans ce repli,
                          les filtres deviendraient donc INATTEIGNABLES sur les
                          écrans étroits : on aurait échangé un en-tête chargé
                          contre un tableau de bord qu'on ne peut plus régler. */}
                      {active.controls ? (
                        <div className="board__head-controls">
                          {active.controls}
                        </div>
                      ) : null}
                      {moreBtn}
                    </div>
                  )}

                  {active.empty ? (
                    <div className="board__chart-empty">{labels.empty}</div>
                  ) : (
                    <div className="board__plot">
                      <div
                        className={`board__chart ${nav === "carousel" ? "chcar-fade" : ""}`}
                        key={nav === "carousel" ? idx : undefined}
                      >
                        {active.node}
                      </div>

                      {/* Clé de lecture — brique ChartKey, partagée par
                          toutes les escales : ce que porte la verticale, ce
                          que porte l'horizontale, ce que dit la couleur,
                          d'où vient le chiffre. */}
                      {/* La colonne se rend dès qu'il y a QUELQUE CHOSE à
                          dire — et il y a toujours au moins un titre. La
                          conditionner à la présence d'une `legend` privait
                          de titre toutes les escales qui n'en déclarent pas
                          encore : l'en-tête est masqué au-dessus de 1180 px
                          puisque la colonne est censée le porter, et sans
                          colonne il ne restait aucun titre à l'écran.
                          Les escales enrichissent ensuite leur `legend` :
                          c'est purement additif. */}
                      {focus ? (
                        <ChartKey
                          title={active.title}
                          more={moreBtn}
                          // Les chiffres-clés de l'escale : `figures` si la
                          // page en fournit, sinon les `kpis` du hero, dont le
                          // format {value, unit, label} est compatible.
                          figures={figures.length ? figures : kpis}
                          // CE QUE VOUS REGARDEZ. La phrase de lecture de la
                          // vue n'était relayée nulle part sur écran large :
                          // elle vivait derrière le « + » et dans l'en-tête
                          // sous 1180 px. Onze escales l'avaient écrite, aucune
                          // ne l'affichait là où on lit.
                          finding={active.finding}
                          y={active.legend?.y}
                          x={active.legend?.x}
                          color={active.legend?.color}
                          caveat={active.legend?.caveat}
                          controls={active.controls}
                          note={active.legend?.note}
                          // L'encodage déclaré par la vue — « polarity » par
                          // défaut, comme la majorité des vues du parcours.
                          swatch={active.legend?.swatch}
                          // La phrase de lecture et la consigne d'exploration
                          // remontent dans la colonne : elles y sont visibles
                          // et rassemblées, au lieu d'un bandeau sous le tracé
                          // et d'une pastille de survol.
                          takeaway={active.takeaway}
                          hint={active.hint}
                          labels={{
                            figures: tf("board.key_figures", "Chiffres-clés", "Key figures"),
                            finding: tf("board.key_finding", "Ce que vous regardez", "What you are looking at"),
                            read: tf("board.key_read", "Comment lire", "How to read"),
                            takeaway: tf("board.key_take", "Ce qu'il faut retenir", "What to take away"),
                            explore: tf("board.key_explore", "À vous de jouer", "Your turn"),
                            y: tf("board.axis_y", "Axe vertical :", "Vertical axis:"),
                            x: tf("board.axis_x", "Axe horizontal :", "Horizontal axis:"),
                            color: tf("board.axis_c", "Couleur :", "Colour:"),
                          }}
                        />
                      ) : null}
                    </div>
                  )}

                  {/* Seul le graphe SIGNATURE garde sa phrase à l'écran :
                      elle porte le message de l'acte. Pour les autres vues,
                      la consigne de lecture vit dans la fiche « + » — elle
                      aide quand on la demande, elle n'encombre pas sinon. */}
                  {active.takeaway && !active.bare && active.signature ? (
                    <p className="board__take board__take--lead">
                      {labels.takeawayKicker ? (
                        <span className="board__take-kicker">
                          {labels.takeawayKicker}
                        </span>
                      ) : null}
                      <span className="board__take-text">{active.takeaway}</span>
                    </p>
                  ) : null}

                  {/* Passage vers le TROISIÈME temps de l'acte. Sans ce
                      bouton, l'outro (étape 2) restait injoignable : rien
                      n'appelait goStep(2), donc la conclusion rédigée de
                      chaque acte n'était jamais lue. Visible sur le dernier
                      graphique seulement, pour ne pas court-circuiter la
                      lecture des précédents. */}
                  {outro && idx === count - 1 && (
                    <div className="board__toconclude">
                      <button
                        type="button"
                        className="board__conclude"
                        onClick={() => goStep(2)}
                      >
                        {tf("board.conclude", "Lire la conclusion", "Read the conclusion")}{" "}
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {readOpen && active && createPortal(
                <div
                  className="board__read"
                  role="dialog"
                  aria-modal="true"
                  aria-label={tf("board.how_to_read", "Comment lire ce graphique", "How to read this chart")}
                >
                  <button
                    type="button"
                    className="board__read-scrim"
                    aria-label={tf("board.close", "Fermer", "Close")}
                    onClick={() => setReadOpen(false)}
                  />
                  <div className="board__read-panel" role="document">
                    <header className="board__read-head">
                      <div>
                        <span className="board__read-eyebrow">
                          {tf("board.how_to_read", "Comment lire ce graphique", "How to read this chart")}
                        </span>
                        {active.title ? (
                          <h3 className="board__read-title">{active.title}</h3>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="board__read-close"
                        onClick={() => setReadOpen(false)}
                        aria-label={tf("board.close", "Fermer", "Close")}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </header>

                    {/* La phrase de résumé ne s'affiche plus au-dessus du
                        tracé : elle est ici, pour qui veut le détail. */}
                    {active.finding ? (
                      <p className="board__read-find">{active.finding}</p>
                    ) : null}

                    {active.takeaway ? (
                      <p className="board__read-take">{active.takeaway}</p>
                    ) : null}

                    {active.legend ? (
                      <dl className="board__read-grid">
                        {active.legend.y ? (
                          <div className="board__read-row">
                            <dt>{tf("board.axis_y", "Axe vertical", "Vertical axis")}</dt>
                            <dd>{active.legend.y}</dd>
                          </div>
                        ) : null}
                        {active.legend.x ? (
                          <div className="board__read-row">
                            <dt>{tf("board.axis_x", "Axe horizontal", "Horizontal axis")}</dt>
                            <dd>{active.legend.x}</dd>
                          </div>
                        ) : null}
                        {active.legend.color ? (
                          <div className="board__read-row">
                            <dt>{tf("board.axis_c", "Couleur", "Colour")}</dt>
                            <dd>{active.legend.color}</dd>
                          </div>
                        ) : null}
                        {active.hint ? (
                          <div className="board__read-row">
                            <dt>{tf("board.explore", "Explorer", "Explore")}</dt>
                            <dd>{active.hint}</dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}

                    {active.legend && active.legend.note ? (
                      <p className="board__read-note">{active.legend.note}</p>
                    ) : null}
                  </div>
                </div>,
                document.body,
              )}

              {infoOpen && hasInfo && createPortal(
                <div
                  className="board__info"
                  role="dialog"
                  aria-modal="true"
                  aria-label={tf("board.info_title", "Données & couverture", "Data & coverage")}
                >
                  <button
                    type="button"
                    className="board__info-scrim"
                    aria-label={tf("board.close", "Fermer", "Close")}
                    onClick={() => setInfoOpen(false)}
                  />
                  <div className="board__info-panel" role="document">
                    <header className="board__info-head">
                      <div>
                        <span className="board__info-eyebrow">
                          {tf("board.info_eyebrow", "Données & méthode", "Data & method")}
                        </span>
                        <h3 className="board__info-title">
                          {tf("board.info_title", "Données & couverture", "Data & coverage")}
                        </h3>
                      </div>
                      <button
                        type="button"
                        className="board__info-close"
                        onClick={() => setInfoOpen(false)}
                        aria-label={tf("board.close", "Fermer", "Close")}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </header>

                    {infoCharts.length > 1 && (
                      <div className="board__info-tabs" role="tablist">
                        {infoCharts.map((c, i) => (
                          <button
                            key={c.id}
                            type="button"
                            role="tab"
                            aria-selected={i === infoTab}
                            className={`board__info-tab ${i === infoTab ? "is-active" : ""}`}
                            onClick={() => setInfoTab(i)}
                          >
                            {c.tab}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="board__info-body">
                      {infoActive && infoActive.title ? (
                        <h4 className="board__info-charttitle">{infoActive.title}</h4>
                      ) : null}
                      {infoActive && infoActive.finding ? (
                        <p className="board__info-finding">{infoActive.finding}</p>
                      ) : null}
                      <div className="board__info-chart">
                        {infoActive ? infoActive.node : null}
                      </div>
                    </div>
                  </div>
                </div>,
                document.body,
              )}
            </section>
          ) : (
            <Loader fullscreen minimal label={labels.loading} />
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