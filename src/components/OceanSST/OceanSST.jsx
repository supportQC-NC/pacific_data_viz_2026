// src/components/OceanSST/OceanSST.jsx
// ============================================================
// Bloc « réchauffement de l'océan » du RÉCIT — réutilise les VRAIS
// graphiques de l'acte Océan (ApexCharts), recâblés sur le jeu officiel SST
// (PDH/SPC · DF_CLIMATE_CHANGE). Deux vues :
//   • Bande d'anomalie : dispersion entre territoires + moyenne régionale,
//     année après année (0 = référence).
//   • Classement : anomalie par territoire, dernière année.
// Filtre régional (Pacifique / Mélanésie / Polynésie / Micronésie) — répond
// à l'exigence d'interactivité du règlement. Données officielles, aucune
// extrapolation. i18n via t(), zéro style inline.
// ============================================================

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLang } from "../../store/context/langContext";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import { pictName, isPict } from "../../i18n/pictNames";
import { valAt } from "../charts/echartsBase";
import { BRAND as EVO_PALETTE } from "../charts/EvolutionLines";
import AnomalyBandChart from "../charts/AnomalyBandChart";
import RankChart from "../charts/RankChart";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";
import Loader from "../Loader/Loader";
import "./OceanSST.scss";

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

export default function OceanSST() {
  const { t, lang } = useLang();
  const dispatch = useDispatch();
  const sst = useSelector(selectDataset("sst"));
  const [region, setRegion] = useState("all");

  useEffect(() => {
    dispatch(loadDataset("sst"));
  }, [dispatch]);

  const ready = sst.status === "succeeded";
  const failed = sst.status === "failed";

  const allSeries = useMemo(() => {
    if (!ready || !sst.data) return [];
    return sst.data.areas
      .filter((a) => isPict(a))
      .map((a) => ({
        area: a,
        name: pictName(a, lang),
        values: (sst.data.byArea[a] || [])
          .filter((p) => Number.isFinite(p.value))
          .sort((x, y) => x.year - y.year),
      }))
      .filter((s) => s.values.length);
  }, [ready, sst.data, lang]);

  const years = useMemo(() => sst.data?.years || [], [sst.data]);
  const currentYear = years.length ? years[years.length - 1] : null;

  const inRegion = useCallback(
    (area) => region === "all" || REGION_OF[area] === region,
    [region],
  );
  const regionSeries = useMemo(
    () => allSeries.filter((s) => inRegion(s.area)),
    [allSeries, inRegion],
  );

  const rankPoints = useMemo(() => {
    const reg = regionSeries;
    const colorByArea = {};
    reg.forEach((s, i) => {
      colorByArea[s.area] = EVO_PALETTE[i % EVO_PALETTE.length];
    });
    return reg
      .map((s) => ({
        area: s.area,
        name: s.name,
        value: valAt(s, currentYear),
        color: colorByArea[s.area] || EVO_PALETTE[0],
      }))
      .filter((p) => Number.isFinite(p.value));
  }, [regionSeries, currentYear]);

  const hasData = regionSeries.length > 0 && years.length > 0;

  return (
    <section className="oceansst" aria-label={t("recit.ocean_band_title")}>
      <div className="oceansst__filters" role="group" aria-label={t("recit.reg_all")}>
        {REGION_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`oceansst__filter ${region === k ? "is-on" : ""}`}
            onClick={() => setRegion(k)}
            aria-pressed={region === k}
          >
            {t(`recit.reg_${k}`)}
          </button>
        ))}
      </div>

      {!ready && !failed && (
        <div className="oceansst__state">
          <Loader />
          <span>{t("recit.ocean_loading")}</span>
        </div>
      )}
      {(failed || (ready && !hasData)) && (
        <div className="oceansst__state">{t("recit.ocean_unavailable")}</div>
      )}

      {ready && hasData && (
        <div className="oceansst__grid">
          <figure className="oceansst__card">
            <figcaption className="oceansst__card-title">
              {t("recit.ocean_band_title")}
            </figcaption>
            <div className="oceansst__chart">
              <ErrorBoundary>
                <AnomalyBandChart
                  series={regionSeries}
                  years={years}
                  unit={t("recit.ocean_sst_unit")}
                  labels={{
                    dispersion: t("recit.ocean_band_disp"),
                    mean: t("recit.ocean_band_mean"),
                  }}
                />
              </ErrorBoundary>
            </div>
            <p className="oceansst__find">{t("recit.ocean_band_find")}</p>
          </figure>

          <figure className="oceansst__card">
            <figcaption className="oceansst__card-title">
              {t("recit.ocean_rank_title")} · {currentYear}
            </figcaption>
            <div className="oceansst__chart">
              <ErrorBoundary>
                <RankChart
                  points={rankPoints}
                  unit={t("recit.ocean_sst_unit")}
                  median={0}
                  refLabel={t("recit.ocean_rank_ref")}
                  sort="desc"
                  scale="lin"
                />
              </ErrorBoundary>
            </div>
          </figure>
        </div>
      )}

      <p className="oceansst__source">{t("recit.ocean_source")}</p>
    </section>
  );
}