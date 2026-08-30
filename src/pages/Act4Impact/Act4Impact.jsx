// src/pages/Act4Impact/Act4Impact.jsx
// ============================================================
// Acte 04 — L'impact humain et matériel des catastrophes (PDH/SPC).
// Deux mesures : personnes affectées & pertes économiques ($).
// Format DASHBOARD (ActBoard) : filtres GLOBAUX (sous-région + mesure),
// la frise des catastrophes en SIGNATURE. 4 graphes.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { pictName, isPict } from "../../i18n/pictNames";
import ActBoard from "../../components/ActBoard/ActBoard";
import ChartFilter from "../../components/ChartFilter/ChartFilter";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import EventTimeline from "../../components/EventTimeline/EventTimeline";
import RankBars from "../../components/RankBars/RankBars";
import TrendChart from "../../components/charts/TrendChart";
import DataSpotlight from "../../components/DataSpotlight/DataSpotlight";
import CoverageChart from "../../components/charts/CoverageChart";
// Les visuels de la Home qui portent les deux jeux de cette escale :
// CrowdAffected lit `disastersAffected`, LossStack lit `disastersLoss` —
// exactement les jeux du sélecteur. Ils restent montés sur la page d'accueil ;
// on les ajoute ici, on ne les déplace pas.
import CrowdAffected from "../../components/CrowdAffected/CrowdAffected";
import LossStack from "../../components/LossStack/LossStack";
import VizSwitch from "../../components/VizSwitch/VizSwitch";
import "./Act4Impact.scss";

const OceanMap = lazy(() => import("../../components/OceanMap/OceanMap"));

const SUBREGIONS = {
  melanesia: ["FJ", "PG", "SB", "VU", "NC"],
  polynesia: ["PF", "WS", "TO", "TV", "CK", "NU", "WF", "TK", "AS", "PN"],
  micronesia: ["FM", "GU", "MP", "MH", "NR", "PW", "KI"],
};
const REGION_OF = Object.entries(SUBREGIONS).reduce((acc, [r, codes]) => {
  codes.forEach((c) => (acc[c] = r));
  return acc;
}, {});
const REGION_KEYS = ["all", "melanesia", "polynesia", "micronesia"];

const fmtNum = (n) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(1).replace(".", ",")} M`
    : n >= 1e3
      ? `${Math.round(n / 1e3)} k`
      : String(Math.round(n));
const fmtMoney = (n) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(1).replace(".", ",")} Md$`
    : n >= 1e6
      ? `${Math.round(n / 1e6)} M$`
      : n >= 1e3
        ? `${Math.round(n / 1e3)} k$`
        : `${Math.round(n)} $`;

function buildEvents(d, lang) {
  if (!d) return [];
  const out = [];
  d.areas.forEach((a) => {
    if (!isPict(a)) return;
    (d.byArea[a] || []).forEach((p) => {
      if (Number.isFinite(p.value) && p.value > 0)
        out.push({
          area: a,
          name: pictName(a, lang),
          year: p.year,
          value: p.value,
        });
    });
  });
  return out;
}
function buildTotals(d, lang) {
  if (!d) return [];
  return d.areas
    .filter((a) => isPict(a))
    .map((a) => {
      const s = d.byArea[a] || [];
      const total = s.reduce(
        (x, p) => x + (Number.isFinite(p.value) ? p.value : 0),
        0,
      );
      return { area: a, code: a, name: pictName(a, lang), value: total };
    })
    .filter((r) => r.value > 0);
}

function buildCoverageSeries(d, lang, inRegion) {
  if (!d) return { series: [], years: [] };
  const yearsSet = new Set();
  const series = d.areas
    .filter((a) => isPict(a) && inRegion(a))
    .map((a) => {
      const values = (d.byArea[a] || [])
        .filter((p) => Number.isFinite(p.value) && p.value > 0)
        .map((p) => {
          yearsSet.add(p.year);
          return { year: p.year, value: p.value };
        });
      return { area: a, name: pictName(a, lang), values };
    })
    .filter((s) => s.values.length);
  return { series, years: [...yearsSet].sort((x, y) => x - y) };
}

// Deux comptes issus du même recensement de catastrophes. Ils partagent une
// limite qu'il faut dire : un total bas peut signifier peu de dégâts — ou une
// déclaration incomplète. La clé de lecture le rappelle sur chaque vue.
const SOURCE_AFF_FR =
  "Recensement des catastrophes, via le Pacific Data Hub — nombre de personnes affectées, cumulé par territoire. Un total bas peut aussi signaler des déclarations incomplètes.";
const SOURCE_AFF_EN =
  "Disaster records, via the Pacific Data Hub - number of people affected, cumulative by territory. A low total may also signal incomplete reporting.";
const SOURCE_LOSS_FR =
  "Recensement des catastrophes, via le Pacific Data Hub — pertes économiques déclarées, cumulées par territoire. Les montants ne sont pas ramenés à la taille de l'économie.";
const SOURCE_LOSS_EN =
  "Disaster records, via the Pacific Data Hub - reported economic losses, cumulative by territory. Amounts are not scaled to the size of each economy.";

export default function Act4Impact() {
  const { t, lang } = useLang();

  // Repli littéral tant que la clé n'est pas versée dans les dictionnaires.
  // Quel dessin est à l'écran, quand l'escale en porte plusieurs.
  const [viz, setViz] = useState("crowd");

  const tx = useCallback(
    (key, fr, en) => {
      const v = t(key);
      return v && v !== key ? v : lang === "en" ? en : fr;
    },
    [t, lang],
  );
  const dispatch = useDispatch();
  const affected = useSelector(selectDataset("disastersAffected"));
  const loss = useSelector(selectDataset("disastersLoss"));

  const [region, setRegion] = useState("all");
  const [metric, setMetric] = useState("affected");

  useEffect(() => {
    dispatch(loadDataset("disastersAffected"));
    dispatch(loadDataset("disastersLoss"));
  }, [dispatch]);

  const ready = affected.status === "succeeded";
  const failed = affected.status === "failed";

  const inRegion = useCallback(
    (area) => region === "all" || REGION_OF[area] === region,
    [region],
  );

  const affEvents = useMemo(
    () => buildEvents(affected.data, lang).filter((e) => inRegion(e.area)),
    [affected.data, lang, inRegion],
  );
  const lossEvents = useMemo(
    () => buildEvents(loss.data, lang).filter((e) => inRegion(e.area)),
    [loss.data, lang, inRegion],
  );
  const affTotals = useMemo(
    () => buildTotals(affected.data, lang).filter((r) => inRegion(r.area)),
    [affected.data, lang, inRegion],
  );
  const lossTotals = useMemo(
    () => buildTotals(loss.data, lang).filter((r) => inRegion(r.area)),
    [loss.data, lang, inRegion],
  );


  const isLoss = metric === "loss";
  const selEvents = isLoss ? lossEvents : affEvents;
  const selTotals = isLoss ? lossTotals : affTotals;
  const selUnit = isLoss ? t("act4.loss_unit") : t("act4.affected_unit");
  const selFormat = isLoss ? fmtMoney : fmtNum;
  const metricLabel = isLoss ? t("act4.loss_title") : t("act4.affected_title");
  const selMax = useMemo(
    () => selTotals.reduce((m, r) => Math.max(m, r.value), 0),
    [selTotals],
  );

  const coverage = useMemo(
    () =>
      buildCoverageSeries(isLoss ? loss.data : affected.data, lang, inRegion),
    [isLoss, loss.data, affected.data, lang, inRegion],
  );

  // Total par année (la fréquence/intensité s'aggrave-t-elle avec le temps ?).
  const annual = useMemo(() => {
    const m = new Map();
    selEvents.forEach((e) => m.set(e.year, (m.get(e.year) || 0) + e.value));
    const yrs = [...m.keys()].sort((a, b) => a - b);
    return {
      years: yrs,
      series: [
        {
          name: metricLabel,
          values: yrs.map((y) => ({ year: y, value: m.get(y) })),
        },
      ],
    };
  }, [selEvents, metricLabel]);

  // Chiffres-clés RETIRÉS de cet écran, comme sur les escales 01 et 02 : le
  // sujet du dashboard, c'est le graphique. Le composant KpiRow n'est pas
  // touché ; les chiffres seront remontés ailleurs.

  const retry = useCallback(() => {
    dispatch(loadDataset("disastersAffected"));
    dispatch(loadDataset("disastersLoss"));
  }, [dispatch]);

  const metricItems = [
    {
      id: "affected",
      label: t("act4.affected_title"),
      icon: "people",
      tone: "warm",
    },
    {
      id: "loss",
      label: t("act4.loss_title"),
      icon: "money",
      tone: "secondary",
    },
  ];
  const regionItems = REGION_KEYS.map((k) => ({
    id: k,
    label: t(`act1.filter.${k}`),
    icon: k === "all" ? "globe" : "map",
    tone: "accent",
  }));

  const status = failed
    ? "error"
    : !ready
      ? "loading"
      : selEvents.length === 0 && selTotals.length === 0
        ? "empty"
        : "ready";

  // Les deux sélecteurs de l'escale passent en menus déroulants. Les listes
  // d'items existantes ({ id, label, … }) sont réutilisées telles quelles :
  // on ne les redéfinit pas, on les adapte à la forme attendue.
  const asOptions = (items) =>
    (items || []).map((it) => ({ value: it.id, label: it.label }));

  // ---------- LES COMMANDES PASSENT AU GRAPHIQUE -----------------------
  // Elles siégeaient dans la barre de l'escale, où elles pesaient sur toute
  // la largeur, poussaient les onglets et laissaient croire à un réglage
  // d'ensemble. Chaque graphique porte désormais les siennes, dans sa colonne
  // de lecture — là où l'on voit ce qu'elles changent. L'en-tête n'a plus que
  // la navigation.
  //
  // La vue des visuels en est exemptée : les dessins ont leur propre
  // sélecteur de territoire et ignorent ces filtres.
  const boardControls = (
    <>
      <ChartFilter
        label={t("act4.board.metric_label")}
        hideLabel
        value={metric}
        onChange={setMetric}
        options={asOptions(metricItems)}
      />
      <ChartFilter
        label={t("act1.filter.title")}
        hideLabel
        value={region}
        onChange={setRegion}
        options={asOptions(regionItems)}
      />
    </>
  );

  // Carte d'identité DOUBLE (personnes affectées + pertes) — 100 % i18n / fiches UNDRR.
  const spotlightRows = [
    { k: t("act4.spotlight.r1k"), v: t("act4.spotlight.r1v") },
    { k: t("act4.spotlight.r2k"), v: t("act4.spotlight.r2v") },
    { k: t("act4.spotlight.r3k"), v: t("act4.spotlight.r3v") },
    { k: t("act4.spotlight.r4k"), v: t("act4.spotlight.r4v") },
  ];
  const spotlightNotes = [
    t("act4.spotlight.n1"),
    t("act4.spotlight.n2"),
    t("act4.spotlight.n3"),
    t("act4.spotlight.n4"),
    t("act4.spotlight.n5"),
  ];

  // Ce que portent les axes change avec l'indicateur : des personnes d'un
  // côté, des montants de l'autre. Les deux sont des GRANDEURS cumulées —
  // pas de zéro chargé de sens, donc une seule teinte.
  const key = isLoss
    ? {
        y: tx(
          "act4.key.loss_y",
          "Pertes économiques déclarées, en cumul. Le montant n'est pas rapporté à la taille de l'économie : une même somme ne pèse pas pareil partout.",
          "Reported economic losses, cumulative. The amount is not scaled to the economy: the same sum does not weigh the same everywhere.",
        ),
        x: tx("act4.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
        color: tx(
          "act4.key.mag_c",
          "Une seule teinte : plus elle est marquée, plus le total est élevé. C'est une grandeur, pas un jugement.",
          "A single hue: the stronger it is, the higher the total. A magnitude, not a judgement.",
        ),
        note: tx("act4.key.loss_note", SOURCE_LOSS_FR, SOURCE_LOSS_EN),
        swatch: "magnitude",
      }
    : {
        y: tx(
          "act4.key.aff_y",
          "Nombre de personnes affectées, en cumul. Ce n'est pas un nombre de victimes : « affecté » couvre du déplacement temporaire à la perte du logement.",
          "Number of people affected, cumulative. This is not a casualty count: \u00ab affected \u00bb spans temporary displacement to loss of home.",
        ),
        x: tx("act4.key.year_x", "Les années, de la plus ancienne à la plus récente.", "Years, oldest to most recent."),
        color: tx(
          "act4.key.mag_c",
          "Une seule teinte : plus elle est marquée, plus le total est élevé. C'est une grandeur, pas un jugement.",
          "A single hue: the stronger it is, the higher the total. A magnitude, not a judgement.",
        ),
        note: tx("act4.key.aff_note", SOURCE_AFF_FR, SOURCE_AFF_EN),
        swatch: "magnitude",
      };

  // ---------- LES VISUELS DE L'ESCALE ----------------------------
  // Ils occupaient chacun leur onglet dans la barre. Or celle-ci
  // énumère les ÉTAPES du raisonnement — tendance, matrice, carte —,
  // et deux dessins qui répondent à la même question n'en font pas
  // deux. Regroupés sous une seule entrée, ils libèrent la barre et
  // le choix passe DANS le panneau, à côté de ce qu'il change.
  //
  // Chaque dessin garde son titre, sa phrase et sa clé de lecture :
  // la colonne de droite reste exacte, ce qu'une fusion aurait perdu.
  const VIZ = {
    crowd: {
              id: "crowd",
              empty: false,
              tab: tx("act4.board.tab_foule", "Foule", "Crowd"),
              title: tx(
                "act4.viz.crowd_title",
                "Les personnes affectées, territoire par territoire",
                "People affected, territory by territory",
              ),
              finding: tx(
                "act4.viz.crowd_find",
                "Choisissez un territoire : la foule suit le nombre de personnes affectées.",
                "Pick a territory: the crowd follows the number of people affected.",
              ),
              takeaway: tx(
                "act4.viz.crowd_take",
                "« Affecté » ne veut pas dire « victime » : le terme couvre du déplacement de quelques jours à la perte du logement. Le chiffre compte des situations très inégales.",
                "« Affected » does not mean « casualty »: it spans a few days' displacement to the loss of a home. The figure counts very unequal situations.",
              ),
              hint: tx(
                "act4.hint.crowd",
                "Changez de territoire avec le sélecteur sous le visuel.",
                "Switch territory with the selector below the visual.",
              ),
              legend: {
                color: tx(
                  "act4.key.crowd_c",
                  "La foule s'épaissit avec le nombre de personnes affectées du territoire choisi.",
                  "The crowd thickens with the chosen territory's number of people affected.",
                ),
                note: tx("act4.key.aff_note", SOURCE_AFF_FR, SOURCE_AFF_EN),
                // Le dessin encode par un NOMBRE de silhouettes, pas une teinte.
                swatch: "none",
              },
              controls: boardControls,
              node: <CrowdAffected embed />,
            },
    lossviz: {
              id: "lossviz",
              empty: false,
              tab: tx("act4.board.tab_pertes", "Pertes", "Losses"),
              title: tx(
                "act4.viz.loss_title",
                "Les pertes économiques, territoire par territoire",
                "Economic losses, territory by territory",
              ),
              finding: tx(
                "act4.viz.loss_find",
                "Choisissez un territoire : la pile suit ses pertes déclarées.",
                "Pick a territory: the stack follows its reported losses.",
              ),
              takeaway: tx(
                "act4.viz.loss_take",
                "Des montants bruts, jamais rapportés à la taille de l'économie : la même somme ne pèse pas du tout le même poids d'un territoire à l'autre.",
                "Raw amounts, never scaled to the size of the economy: the same sum carries a very different weight from one territory to the next.",
              ),
              hint: tx(
                "act4.hint.loss",
                "Changez de territoire avec le sélecteur sous le visuel.",
                "Switch territory with the selector below the visual.",
              ),
              legend: {
                color: tx(
                  "act4.key.loss_viz_c",
                  "La pile monte avec les pertes déclarées du territoire choisi.",
                  "The stack rises with the chosen territory's reported losses.",
                ),
                note: tx("act4.key.loss_note", SOURCE_LOSS_FR, SOURCE_LOSS_EN),
                swatch: "none",
              },
              controls: boardControls,
              node: <LossStack embed />,
            },
  };

  const vizItems = [
    { id: "crowd", label: tx("act4.viz.sw_crowd", "Personnes", "People") },
    { id: "lossviz", label: tx("act4.viz.sw_lossviz", "Pertes", "Losses") },
  ];
  const activeViz = VIZ[viz] || VIZ.crowd;

  const charts =
    status === "ready"
      ? [
          {
            ...activeViz,
            id: "viz",
            // L'onglet porte le nom du dessin affiché — « Pousse », « Verre »,
            // « Foule »… — et change avec la bascule. La barre annonce ainsi ce
            // qu'on va voir, comme sur les escales 01 et 02, au lieu de la
            // catégorie à laquelle il appartient.
            finding: tx(
              "act4.viz.embed_find",
              "Un dessin plutôt qu'un graphique : la grandeur se lit dans sa forme — sa hauteur, sa densité, son remplissage. Le sélecteur sous l'image change de territoire.",
              "A drawing rather than a chart: the quantity is read from its shape — height, density, fill. The selector below the image switches territory.",
            ),
            takeaway: tx(
              "act4.viz.embed_take",
              "Un chiffre isolé ne dit rien tant qu'on ne l'a pas comparé. Le dessin donne une échelle intuitive ; les vues suivantes donnent les valeurs exactes.",
              "A lone figure says nothing until you compare it. The drawing gives an intuitive scale; the next views give the exact values.",
            ),
            hint: tx(
              "act4.viz.embed_hint",
              "Changez de territoire sous l'image, et de dessin avec la bascule au-dessus.",
              "Switch territory below the image, and drawing with the toggle above.",
            ),
            legend: {
              // Aucune échelle de couleur : ces dessins encodent par la forme.
              // La pastille reste un cadre vide, ce qui est la seule chose
              // honnête à montrer quand la couleur ne mesure rien.
              swatch: "none",
              color: tx(
                "act4.viz.embed_c",
                "La couleur ne mesure rien ici : c'est la forme du dessin qui porte la valeur.",
                "Colour measures nothing here: the drawing's shape carries the value.",
              ),
              note: key.note,
            },
            node: (
              <div className="vizpane">
                <VizSwitch
                  items={vizItems}
                  value={viz}
                  onChange={setViz}
                  label={tx("act4.viz.sw_label", "Visuel", "Visual")}
                />
                <div className="vizpane__body">{activeViz.node}</div>
              </div>
            ),
          },
          // ---------- Les visuels interactifs, en ouverture ----------------
          // Deux dessins de la Home, un par indicateur, lisant exactement les
          // mêmes jeux que le sélecteur : la foule pour les personnes
          // affectées, la pile pour les pertes déclarées. Ils restent montés
          // sur la page d'accueil ; on les ajoute ici, on ne les déplace pas.
          //
          // Ils ouvrent parce qu'un cumul à sept chiffres ne se ressent pas :
          // le dessin lui donne une taille avant que les courbes ne le
          // mettent en série.
          {
            id: "timeline",
            signature: true,
            empty: selEvents.length === 0,
            tab: tx("act4.board.tab_frise", "Frise", "Timeline"),
            title: `${t("act4.timeline_title")} · ${metricLabel}`,
            finding: t("act4.board.timeline_find"),
            takeaway: t("act4.board.timeline_take"),
            legend: { ...key, swatch: "none" },
            hint: tx(
              "act4.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            controls: boardControls,
            node: (
              <div className="act4b__scroll">
                <EventTimeline
                  events={selEvents}
                  unit={selUnit}
                  format={selFormat}
                />
              </div>
            ),
          },
          {
            id: "read",
            empty: false,
            tab: t("act4.board.tab_read"),
            title: t("act4.read_title"),
            finding: t("act4.board.read_find"),
            takeaway: t("act4.board.read_take"),
            node: (
              <DataSpotlight
                rows={spotlightRows}
                notes={spotlightNotes}
                example={{
                  kicker: t("act4.spotlight.ex_kicker"),
                  text: t("act4.spotlight.ex_text"),
                }}
                link={{
                  href: "https://www.preventionweb.net/files/54970_collectionoftechnicalguidancenoteso.pdf",
                  label: t("act4.spotlight.link_label"),
                }}
              />
            ),
          },
          {
            id: "annual",
            empty: annual.years.length < 2,
            tab: tx("act4.board.tab_annees", "Années", "Years"),
            title: `${t("act4.board.annual_title")} · ${metricLabel}`,
            finding: t("act4.board.annual_find"),
            takeaway: t("act4.board.annual_take"),
            legend: { ...key, swatch: "none" },
            hint: tx(
              "act4.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            controls: boardControls,
            node: (
              <TrendChart
                series={annual.series}
                years={annual.years}
                unit={selUnit}
                scale="lin"
              />
            ),
          },
          {
            id: "rank",
            empty: selTotals.length === 0,
            tab: tx("act4.board.tab_classement", "Classement", "Ranking"),
            title: `${t("act4.rank_title")} · ${metricLabel}`,
            finding: t("act4.board.rank_find"),
            takeaway: t("act4.board.rank_take"),
            legend: { ...key, y: tx("act4.key.terr_y", "Un territoire par ligne.", "One territory per row."), x: key.y },
              swatch: "none",
            hint: tx(
              "act4.hint.hover",
              "Survolez le tracé pour lire une valeur précise.",
              "Hover the plot to read a single value.",
            ),
            controls: boardControls,
            node: (
              <div className="act4b__scroll">
                <RankBars data={selTotals} unit={selUnit} />
              </div>
            ),
          },
          {
            id: "map",
            empty: selTotals.length === 0,
            tab: tx("act4.board.tab_carte", "Carte", "Map"),
            title: `${t("act4.map_title")} · ${metricLabel}`,
            finding: t("act4.board.map_find"),
            takeaway: t("act4.board.map_take"),
            legend: { color: key.color, note: key.note, swatch: key.swatch },
            hint: tx(
              "act4.hint.map",
              "Faites tourner le globe et survolez un territoire pour lire sa valeur.",
              "Spin the globe and hover a territory to read its value.",
            ),
            controls: boardControls,
            node: (
              <ErrorBoundary
                fallback={
                  <div className="board__state board__state--err">
                    {t("scene.error")}
                  </div>
                }
              >
                <Suspense
                  fallback={<Loader compact label={t("scene.loading")} />}
                >
                  <OceanMap
                    data={selTotals}
                    // Deux cumuls, donc deux GRANDEURS : une seule teinte, du
                    // plus faible au plus élevé, comme la pastille de la
                    // colonne de lecture l'annonce.
                    ramp="magnitude"
                    mid={null}
                    unit={selUnit}
                    range={{ min: 0, max: selMax }}
                    logScale
                    lowLabel={t("act4.map_low")}
                    highLabel={t("act4.map_high")}
                    noTokenMsg={t("act1.map_no_token")}
                  />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            id: "coverage",
            empty: coverage.series.length === 0,
            tab: t("act4.board.tab_coverage"),
            title: `${t("act4.coverage_title")} · ${metricLabel}`,
            finding: t("act4.board.coverage_find"),
            takeaway: t("act4.board.coverage_take"),
            node: (
              <CoverageChart
                series={coverage.series}
                years={coverage.years}
                labels={{
                  present: t("act1.coverage.present"),
                  absent: t("act1.coverage.absent"),
                }}
              />
            ),
          },
        ]
      : [];

  return (
    <ActBoard
      status={status}
      onRetry={retry}
      back={{ to: "/", label: t("act1.back") }}
      eyebrow={t("home.acts.a4_tag")}
      title={t("home.acts.a4_title")}
      thesis={t("act4.thesis")}
      // L'en-tête ne porte plus de filtres : chaque graphique a les siens.
      filters={null}
      charts={charts}
      // Disposition du template d'escale : barre unique (navigation entre
      // escales ET entre vues sur une seule rangée), décor de l'escale en
      // fond, colonne de lecture à droite, hauteurs de tracé égales d'une
      // vue à l'autre. Voir ActBoard.scss § FOCUS. Modèle : escale 02.
      focus
      nav="carousel"
      progress={{ index: 9, total: 12 }}
      labels={{
        loading: t("scene.loading"),
        empty: t("act1.empty"),
        error: t("scene.error"),
        retry: t("act1.retry"),
        switchHint: t("act4.board.switch_hint"),
        signature: t("act4.board.signature"),
        takeawayKicker: t("act4.board.takeaway_kicker"),
        prev: t("act1.nav.prev"),
        next: t("act1.nav.next"),
        start: t("act4.board.start"),
        conclusion: t("act4.board.conclusion"),
        backIntro: t("act4.board.back_intro"),
        reviseData: t("act4.board.revise_data"),
      }}
      outro={{
        kicker: t("act4.outro.kicker"),
        title: t("act4.outro.title"),
        text: t("act4.outro.text"),
        primary: { to: "/momentum", label: t("act4.outro.next") },
        secondary: { to: "/", label: t("act4.outro.home") },
      }}
    />
  );
}
