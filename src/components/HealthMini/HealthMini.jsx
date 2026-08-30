// src/components/HealthMini/HealthMini.jsx
// ============================================================
// LE COMPAGNON : L'AUTRE MESURE, EN PETIT, POUR LE MÊME TERRITOIRE.
//
// L'escale 08 pose une question de croisement — « l'eau potable protège-t-elle
// la santé ? » — et proposait deux dessins qu'on ne pouvait voir que l'un
// APRÈS l'autre. Le lecteur devait donc retenir un chiffre, basculer, et
// comparer de mémoire. C'est précisément le geste qu'une visualisation est
// censée lui épargner.
//
// Ce compagnon montre l'autre indicateur du territoire couramment sélectionné,
// à côté du grand dessin : le verre a son champ de bacilles en vignette, le
// champ de bacilles a son verre. La comparaison redevient un coup d'œil.
//
// Il lit le jeu de données depuis le store et le charge s'il ne l'est pas
// encore : les deux dessins sont indépendants, aucun ne garantit que l'autre
// série est déjà là.
//
// Ce qu'il ne fait PAS : affirmer un lien. Les deux nombres sont posés côte à
// côte, sans flèche ni ratio. L'un est un pourcentage d'accès, l'autre une
// incidence pour 100 000 — les mettre en rapport serait une opération que la
// donnée ne justifie pas.
//
// Props : kind "water" | "tb" · code (territoire) · labels {title, unit}
// ============================================================

import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadDataset, selectDataset } from "../../store/slices/climateSlice";
import "./HealthMini.scss";

const DATASET = { water: "water", tb: "tuberculosis" };

function lastFinite(serie) {
  for (let i = serie.length - 1; i >= 0; i -= 1)
    if (Number.isFinite(serie[i].value)) return serie[i];
  return null;
}

export default function HealthMini({ kind, code, labels = {} }) {
  const dispatch = useDispatch();
  const key = DATASET[kind];
  const ds = useSelector(selectDataset(key));

  useEffect(() => {
    if (ds.status === "idle") dispatch(loadDataset(key));
  }, [dispatch, ds.status, key]);

  const point = useMemo(() => {
    if (ds.status !== "succeeded" || !ds.data || !code) return null;
    const serie = ds.data.byArea[code];
    if (!serie || !serie.length) return null;
    return lastFinite(serie);
  }, [ds.status, ds.data, code]);

  // La bordure de l'ensemble reste montée même sans valeur : une vignette qui
  // apparaît et disparaît selon le territoire ferait sauter la mise en page.
  const value = point ? point.value : null;

  // Remplissage du verre : le pourcentage, tel quel.
  const fill = kind === "water" && value != null ? Math.max(0, Math.min(1, value / 100)) : 0;

  // Densité du champ : l'incidence, ramenée à une échelle lisible. 700 est
  // l'ordre de grandeur du maximum observé dans le Pacifique ; au-delà on
  // sature plutôt que d'ajouter des bacilles illisibles.
  const dots = kind === "tb" && value != null
    ? Math.max(1, Math.round(Math.min(1, value / 700) * 14))
    : 0;

  const BACILLI = useMemo(
    () =>
      Array.from({ length: dots }, (_, i) => {
        const a = (i * 137.5 * Math.PI) / 180;
        const r = 5 + 13 * Math.sqrt((i + 0.6) / Math.max(1, dots));
        return {
          x: 24 + r * Math.cos(a),
          y: 24 + r * Math.sin(a),
          rot: Math.round((a * 180) / Math.PI),
        };
      }),
    [dots],
  );

  return (
    <aside className="hmini" aria-label={labels.title}>
      <p className="hmini__label">{labels.title}</p>
      <div className="hmini__row">
        <svg className="hmini__svg" viewBox="0 0 48 48" aria-hidden="true">
          {kind === "water" ? (
            <>
              <clipPath id={`hmini-cup-${code || "x"}`}>
                <path d="M12,8 L36,8 L33,40 Q32.6,42 30,42 L18,42 Q15.4,42 15,40 Z" />
              </clipPath>
              <g clipPath={`url(#hmini-cup-${code || "x"})`}>
                <rect
                  className="hmini__water"
                  x="10"
                  y={8 + (1 - fill) * 34}
                  width="28"
                  height={fill * 34 + 2}
                />
              </g>
              <path
                className="hmini__cup"
                d="M12,8 L36,8 L33,40 Q32.6,42 30,42 L18,42 Q15.4,42 15,40 Z"
                fill="none"
              />
            </>
          ) : (
            <>
              <circle className="hmini__field" cx="24" cy="24" r="20" />
              {BACILLI.map((b, i) => (
                <rect
                  key={i}
                  className="hmini__bac"
                  x={b.x - 3}
                  y={b.y - 1}
                  width="6"
                  height="2"
                  rx="1"
                  transform={`rotate(${b.rot} ${b.x} ${b.y})`}
                />
              ))}
            </>
          )}
        </svg>
        <p className="hmini__val">
          {value == null ? "—" : Math.round(value).toLocaleString()}
          <span className="hmini__unit">{labels.unit}</span>
        </p>
      </div>
    </aside>
  );
}
