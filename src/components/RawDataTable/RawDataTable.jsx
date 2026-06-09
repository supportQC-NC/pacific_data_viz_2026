// src/components/RawDataTable/RawDataTable.jsx
// ============================================================
// Tableau de DONNÉES BRUTES, léger et sans dépendance (repli d'ApexGrid, qui
// n'est pas compatible avec le bundler de Create React App).
//   • tri au clic sur l'en-tête (numérique / texte selon le type de colonne)
//   • filtre rapide (recherche sur toutes les colonnes)
//   • pagination locale
//   • export CSV (UTF-8 BOM) des lignes filtrées/triées
// Calé sur les tokens du design, dark/light via variables. Aucun texte en dur
// (libellés via props `labels`).
//
// Props :
//   columns : [{ key, label, type: "string" | "number" | "year" }]
//   data    : [ { [key]: value } ]
//   labels  : { search, export, prev, next, empty }
//   locale  : "fr-FR" | "en-US"
//   fileName: nom du fichier CSV exporté
//   pageSize: lignes par page (défaut 25)
// ============================================================

import React, { useMemo, useState } from "react";
import "./RawDataTable.scss";

function isNum(type) {
  return type === "number" || type === "year";
}

function formatCell(value, type, locale) {
  if (value == null || value === "") return "—";
  if (type === "year") return String(value);
  if (type === "number" && typeof value === "number") {
    return value.toLocaleString(locale, { maximumFractionDigits: 3 });
  }
  return String(value);
}

function toCSV(columns, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => esc(r[c.key])).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

export default function RawDataTable({
  columns = [],
  data = [],
  labels = {},
  locale = "fr-FR",
  fileName = "data.csv",
  pageSize = 25,
}) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState(columns[0] ? columns[0].key : "");
  const [dir, setDir] = useState("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((r) =>
      columns.some((c) => String(r[c.key]).toLowerCase().includes(needle)),
    );
  }, [data, columns, q]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    const numeric = col ? isNum(col.type) : false;
    const f = dir === "asc" ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (numeric) {
        return f * ((av == null ? -Infinity : av) - (bv == null ? -Infinity : bv));
      }
      return f * String(av).localeCompare(String(bv));
    });
    return arr;
  }, [filtered, columns, sortKey, dir]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const view = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const onSort = (key) => {
    if (key === sortKey) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDir("asc");
    }
    setPage(0);
  };
  const caret = (key) => (sortKey === key ? (dir === "asc" ? " \u25b2" : " \u25bc") : "");

  const onExport = () => {
    const csv = `\uFEFF${toCSV(columns, sorted)}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const start = sorted.length ? safePage * pageSize + 1 : 0;
  const end = Math.min(sorted.length, safePage * pageSize + pageSize);

  return (
    <div className="rawtable">
      <div className="rawtable__toolbar">
        <input
          className="rawtable__search"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder={labels.search || ""}
          aria-label={labels.search || "filter"}
        />
        <button type="button" className="rawtable__export" onClick={onExport}>
          {labels.export || "CSV"}
        </button>
      </div>

      <div className="rawtable__scroll">
        <table className="rawtable__table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`rawtable__th rawtable__th--sort ${isNum(c.type) ? "rawtable__th--num" : ""}`}
                  onClick={() => onSort(c.key)}
                >
                  {c.label}
                  {caret(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr className="rawtable__row" key={`${safePage}-${i}`}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`rawtable__td ${isNum(c.type) ? "rawtable__td--num" : ""}`}
                  >
                    {formatCell(r[c.key], c.type, locale)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!sorted.length ? <p className="rawtable__empty">{labels.empty || ""}</p> : null}
      </div>

      <div className="rawtable__pager">
        <span className="rawtable__count">
          {start}{"\u2013"}{end} / {sorted.length.toLocaleString(locale)}
        </span>
        <div className="rawtable__pager-btns">
          <button
            type="button"
            className="rawtable__pg"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage <= 0}
            aria-label={labels.prev || "previous"}
          >
            {"\u2039"}
          </button>
          <span className="rawtable__pg-info">
            {safePage + 1} / {pages}
          </span>
          <button
            type="button"
            className="rawtable__pg"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={safePage >= pages - 1}
            aria-label={labels.next || "next"}
          >
            {"\u203a"}
          </button>
        </div>
      </div>
    </div>
  );
}