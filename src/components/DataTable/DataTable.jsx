// src/components/DataTable/DataTable.jsx
// ============================================================
// Tableau de données triable (année courante).
// Colonnes : Rang · Code · Territoire · Valeur · Écart vs moyenne mondiale.
// Tri au clic sur l'en-tête. Aucun texte en dur (labels via props).
// Props :
//   rows     : [{ code, name, value }]
//   labels   : { col_rank, col_code, col_name, col_value, col_vs_world }
//   unit     : string
//   refValue : number | null   (moyenne mondiale)
// ============================================================

import React, { useMemo, useState } from "react";
import "./DataTable.scss";

const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "—");
const fmtSigned = (n) => (n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2));

export default function DataTable({
  rows = [],
  labels = {},
  unit = "",
  refValue = null,
}) {
  const [sortKey, setSortKey] = useState("value");
  const [dir, setDir] = useState("desc");

  const enriched = useMemo(
    () =>
      rows.map((r) => ({
        code: r.code,
        name: r.name,
        value: r.value,
        vs: refValue != null ? r.value - refValue : null,
      })),
    [rows, refValue],
  );

  const sorted = useMemo(() => {
    const arr = [...enriched];
    const f = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === "name" || sortKey === "code") {
        return f * String(av).localeCompare(String(bv));
      }
      av = av == null ? -Infinity : av;
      bv = bv == null ? -Infinity : bv;
      return f * (av - bv);
    });
    return arr;
  }, [enriched, sortKey, dir]);

  const onSort = (key) => {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir(key === "name" || key === "code" ? "asc" : "desc");
    }
  };

  const caret = (key) => (sortKey === key ? (dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div className="dtable">
      <table className="dtable__table">
        <thead>
          <tr>
            <th className="dtable__th dtable__th--num">{labels.col_rank}</th>
            <th
              className="dtable__th dtable__th--sort"
              onClick={() => onSort("code")}
            >
              {labels.col_code}
              {caret("code")}
            </th>
            <th
              className="dtable__th dtable__th--sort"
              onClick={() => onSort("name")}
            >
              {labels.col_name}
              {caret("name")}
            </th>
            <th
              className="dtable__th dtable__th--sort dtable__th--num"
              onClick={() => onSort("value")}
            >
              {labels.col_value}
              {caret("value")}
            </th>
            <th
              className="dtable__th dtable__th--sort dtable__th--num"
              onClick={() => onSort("vs")}
            >
              {labels.col_vs_world}
              {caret("vs")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr className="dtable__row" key={`${r.code}-${i}`}>
              <td className="dtable__td dtable__td--num dtable__td--mute">
                {i + 1}
              </td>
              <td className="dtable__td dtable__td--code">{r.code}</td>
              <td className="dtable__td">{r.name}</td>
              <td className="dtable__td dtable__td--num dtable__td--strong">
                {fmt2(r.value)}
              </td>
              <td
                className={`dtable__td dtable__td--num ${
                  r.vs == null ? "" : r.vs > 0 ? "is-up" : "is-down"
                }`}
              >
                {r.vs == null ? "—" : fmtSigned(r.vs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {unit && <p className="dtable__unit">{unit}</p>}
    </div>
  );
}
