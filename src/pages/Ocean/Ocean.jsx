// src/pages/Ocean/Ocean.jsx
// ============================================================
// Chapitre Océan — moteur Va'a, puis carte satellite des points de côte.
//
// 1) VOYAGE (VaaChapter) — pour chaque territoire, deux indicateurs :
//    • ANOMALIE DE TEMPÉRATURE (°C vs normale 1971–2000 — via useCiel / PDH ;
//      donnée de température de l'air, pas SST).
//    • TRAIT DE CÔTE (m/an — médiane des segments, Digital Earth Pacific /
//      Landsat, données statiques coastlineByTerritory).
//    « Donnée indisponible » si l'un manque ; traversée = union.
//
// 2) CARTE PLEINE HAUTEUR (OceanMap + coastlineUrl) — les VRAIS points du
//    trait de côte sur fond satellite : rouge = recul, bleu = avancée.
//    Réutilise le composant carte déjà présent dans l'app (Act3/CountryPage).
// ============================================================

import React, { useMemo, lazy, Suspense } from "react";
import VaaChapter from "../../components/VaaChapter/VaaChapter";
import SeaWarm from "../../components/SeaWarm/SeaWarm";
import CoastlineShift from "../../components/CoastlineShift/CoastlineShift";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import Loader from "../../components/Loader/Loader";
import COASTLINE from "../../data/coastlineByTerritory";
import { VAA_ROUTE } from "../../data/vaaRoute";
import { isPict, pictName } from "../../i18n/pictNames";
import { useLang } from "../../store/context/langContext";
import useCiel from "../../hooks/UseCiel";
import heroImage from "../../bg.jpg";
import "./Ocean.scss";

// Carte satellite (chargée à la demande) ; même composant que les actes.
const OceanMap = lazy(() => import("../../components/OceanMap/OceanMap"));
const COAST_URL = `${process.env.PUBLIC_URL || ""}/data/coastline-hotspots.geojson`;

// Tendance de réchauffement : signe de (dernière − première valeur finie).
function seaTrendOf(landTemp, code) {
  if (!landTemp || landTemp.status !== "live" || !landTemp.byArea) return null;
  const serie = landTemp.byArea[code];
  if (!Array.isArray(serie)) return null;
  const fin = serie.filter((p) => p && Number.isFinite(p.value));
  if (fin.length < 2) return null;
  const d = fin[fin.length - 1].value - fin[0].value;
  return d > 0 ? "up" : d < 0 ? "down" : "flat";
}

export default function Ocean() {
  const { lang, t } = useLang();
  const ciel = useCiel(lang);
  const landTemp = ciel.data && ciel.data.landTemp;

  // Territoires documentés.
  const coastAreas = useMemo(
    () => new Set(COASTLINE.filter((d) => isPict(d.area)).map((d) => d.area)),
    [],
  );
  const seaAreas = useMemo(() => {
    if (!landTemp || landTemp.status !== "live" || !landTemp.byArea) return null;
    const s = new Set();
    Object.entries(landTemp.byArea).forEach(([code, serie]) => {
      if (
        isPict(code) &&
        Array.isArray(serie) &&
        serie.some((p) => p && Number.isFinite(p.value))
      )
        s.add(code);
    });
    return s.size ? s : null;
  }, [landTemp]);

  // Union : au moins une des deux données.
  const route = useMemo(() => {
    const r = VAA_ROUTE.filter(
      (c) => coastAreas.has(c) || (seaAreas && seaAreas.has(c)),
    );
    return r.length ? r : undefined;
  }, [coastAreas, seaAreas]);

  const indicators = useMemo(
    () => [
      {
        render: (code) => <SeaWarm embed code={code} />,
        labelKey: "vaa.ocean.sea",
        available: seaAreas,
        trend: (code) => seaTrendOf(landTemp, code),
        goodWhen: "down", // moins de réchauffement = mieux
      },
      {
        render: (code) => <CoastlineShift embed code={code} />,
        labelKey: "vaa.ocean.coast",
        available: coastAreas,
      },
    ],
    [seaAreas, coastAreas, landTemp],
  );

  // Carte des points : tous les territoires côtiers documentés.
  const coastRows = useMemo(
    () =>
      COASTLINE.filter((d) => isPict(d.area)).map((d) => ({
        ...d,
        name: pictName(d.area, lang),
      })),
    [lang],
  );

  const L =
    lang === "en"
      ? {
          low: "Retreat",
          mid: "Stable",
          high: "Advance",
          noToken: "Map unavailable (missing Mapbox token)",
          loading: "Loading map…",
        }
      : {
          low: "Recul",
          mid: "Stable",
          high: "Avancée",
          noToken: "Carte indisponible (jeton Mapbox manquant)",
          loading: "Chargement de la carte…",
        };

  return (
    <>
      <VaaChapter
        accent="ocean"
        heroImage={heroImage}
        eyebrowKey="chapters.ocean.eyebrow"
        titleKey="chapters.ocean.title"
        ledeKey="chapters.ocean.lede"
        problemKey="chapters.ocean.problem"
        messageKey="chapters.ocean.message"
        questionKey="vaa.ocean.question"
        route={route}
        indicators={indicators}
      />

      {/* Carte satellite pleine hauteur — les vrais points du trait de côte. */}
      <section className="coastmap" aria-label={t("chapters.ocean.map_title")}>
        <div className="coastmap__inner">
          <header className="coastmap__head">
            <h2 className="coastmap__title">{t("chapters.ocean.map_title")}</h2>
            <p className="coastmap__lede">{t("chapters.ocean.map_lede")}</p>
          </header>

          <div className="coastmap__map">
            <ErrorBoundary
              fallback={<div className="coastmap__fallback">{t("vaa.error")}</div>}
            >
              <Suspense
                fallback={<div className="coastmap__fallback">{L.loading}</div>}
              >
                <OceanMap
                  data={[]}
                  fitAreas={coastRows}
                  unit="m/an"
                  range={{ min: -0.5, max: 0.5 }}
                  ramp="semantic"
                  mid={0}
                  lowLabel={L.low}
                  midLabel={L.mid}
                  highLabel={L.high}
                  noTokenMsg={L.noToken}
                  coastlineUrl={COAST_URL}
                />
              </Suspense>
            </ErrorBoundary>
          </div>

          <p className="coastmap__source">{t("chapters.ocean.map_source")}</p>
        </div>
      </section>
    </>
  );
}