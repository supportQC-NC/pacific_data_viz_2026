// src/components/ExportBar/ExportBar.jsx
// ============================================================
// Export PRO — PDF (rapport multi-pages) + Excel (3 feuilles).
// Sûr : export au clic, aucun useEffect → aucune boucle.
//
// PDF :
//   p.1  bandeau titre + sous-titre + capture du graphe + ligne de stats
//   p.2  tableau de classement (rang/code/territoire/valeur/écart)
//   pied : source · date · pagination
// Excel :
//   "Classement"  année courante (heatmap, filtre, en-tête figé)
//   "Séries"      matrice territoires × années + ligne moyenne mondiale
//                 (heatmap temporelle) — la moyenne mondiale est MOBILE
//   "Synthèse"    statistiques
//
// API meta : { title, subtitle, source, filename, sheet, unit,
//              refValue, refLabel, year, series, years, worldByYear }
//   series : [{ code, name, values:[{year,value}] }]
//   worldByYear : { [year]: number }
// ============================================================

import React, { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./ExportBar.scss";

const C = {
  ink: "FF0B1E2D",
  headerBg: "FF0E2A3F",
  headerText: "FFFFFFFF",
  sub: "FF5B6B7A",
  line: "FFE3E8EF",
  zebra: "FFF5F8FB",
  low: "FF1F9BC9",
  mid: "FFFFD166",
  high: "FFFF5A36",
  world: "FFFF5A36",
};
const PDF = {
  ink: [11, 30, 45],
  sub: [91, 107, 122],
  band: [14, 42, 63],
  white: [255, 255, 255],
  line: [210, 220, 230],
  zebra: [245, 248, 251],
};

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const today = () => new Date().toISOString().slice(0, 10);
const colLetter = (n) => {
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
};

export default function ExportBar({
  targetRef,
  rows = [],
  meta = {},
  labels = {},
}) {
  const [busy, setBusy] = useState(false);

  const {
    title = "",
    subtitle = "",
    source = "",
    filename = "export",
    sheet = "Data",
    unit = "",
    refValue = null,
    refLabel = "",
    year = "",
    series = [],
    years = [],
    worldByYear = {},
  } = meta;

  // -------------------------------------------------------- PDF
  const exportPdf = useCallback(async () => {
    const node = targetRef && targetRef.current;
    if (busy) return;
    setBusy(true);
    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 36;

      // --- Bandeau titre ---
      pdf.setFillColor(...PDF.band);
      pdf.rect(0, 0, pageW, 56, "F");
      pdf.setTextColor(...PDF.white);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text(String(title), margin, 30);
      if (subtitle) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text(String(subtitle), margin, 46);
      }

      // --- Capture du graphe ---
      let cursorY = 80;
      if (node) {
        const canvas = await html2canvas(node, {
          backgroundColor: null,
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const img = canvas.toDataURL("image/png");
        const availW = pageW - margin * 2;
        const maxH = pageH - cursorY - 80;
        let w = availW;
        let h = availW * (canvas.height / canvas.width);
        if (h > maxH) {
          h = maxH;
          w = maxH * (canvas.width / canvas.height);
        }
        pdf.addImage(img, "PNG", margin, cursorY, w, h);
        cursorY += h + 24;
      }

      // --- Ligne de stats ---
      const vals = rows.map((r) => r.value);
      if (vals.length) {
        const s = {
          n: vals.length,
          max: Math.max(...vals),
          min: Math.min(...vals),
          med: median(vals),
          avg: mean(vals),
        };
        const parts = [
          `${labels.summary_count || "n"}: ${s.n}`,
          `${labels.summary_max || "max"}: ${s.max.toFixed(2)}`,
          `${labels.summary_mean || "moy."}: ${s.avg.toFixed(2)}`,
          `${labels.summary_median || "méd."}: ${s.med.toFixed(2)}`,
          refValue != null
            ? `${refLabel || "monde"}: ${Number(refValue).toFixed(2)}`
            : null,
          unit,
        ].filter(Boolean);
        pdf.setTextColor(...PDF.sub);
        pdf.setFontSize(9);
        pdf.text(parts.join("    ·    "), margin, cursorY);
      }

      // --- Page 2 : tableau de classement ---
      if (rows.length) {
        pdf.addPage();
        pdf.setFillColor(...PDF.band);
        pdf.rect(0, 0, pageW, 40, "F");
        pdf.setTextColor(...PDF.white);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text(
          `${title} — ${labels.sheet_data || "Données"} ${year}`,
          margin,
          26,
        );

        const sorted = [...rows].sort((a, b) => b.value - a.value);
        const head = [
          labels.col_rank || "#",
          labels.col_code || "Code",
          labels.col_name || "Territoire",
          labels.col_value || "Valeur",
          labels.col_vs_world || "Écart",
        ];
        const colW = [40, 60, 250, 110, 130];
        const aligns = ["center", "center", "left", "right", "right"];
        let tx = margin;
        const xs = colW.map((w) => {
          const x = tx;
          tx += w;
          return x;
        });
        let ty = 64;
        const rowH = 17;

        // header
        pdf.setFillColor(...PDF.band);
        pdf.rect(
          margin,
          ty - 12,
          colW.reduce((a, b) => a + b, 0),
          rowH,
          "F",
        );
        pdf.setTextColor(...PDF.white);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        head.forEach((hd, i) => {
          const x =
            aligns[i] === "right"
              ? xs[i] + colW[i] - 6
              : aligns[i] === "center"
                ? xs[i] + colW[i] / 2
                : xs[i] + 6;
          pdf.text(String(hd), x, ty, { align: aligns[i] });
        });
        ty += rowH;

        // rows
        pdf.setFont("helvetica", "normal");
        sorted.forEach((r, i) => {
          if (ty > pageH - 30) {
            pdf.addPage();
            ty = 50;
          }
          if (i % 2 === 1) {
            pdf.setFillColor(...PDF.zebra);
            pdf.rect(
              margin,
              ty - 12,
              colW.reduce((a, b) => a + b, 0),
              rowH,
              "F",
            );
          }
          const vs = refValue != null ? r.value - refValue : null;
          const cells = [
            String(i + 1),
            r.code || "",
            r.name || "",
            r.value.toFixed(2),
            vs == null ? "—" : vs > 0 ? `+${vs.toFixed(2)}` : vs.toFixed(2),
          ];
          cells.forEach((cell, ci) => {
            pdf.setTextColor(
              ...(ci === 4 && vs != null
                ? vs > 0
                  ? [200, 70, 40]
                  : [30, 120, 160]
                : PDF.ink),
            );
            const x =
              aligns[ci] === "right"
                ? xs[ci] + colW[ci] - 6
                : aligns[ci] === "center"
                  ? xs[ci] + colW[ci] / 2
                  : xs[ci] + 6;
            pdf.text(String(cell), x, ty, { align: aligns[ci] });
          });
          pdf.setDrawColor(...PDF.line);
          pdf.line(
            margin,
            ty + 4,
            margin + colW.reduce((a, b) => a + b, 0),
            ty + 4,
          );
          ty += rowH;
        });
      }

      // --- Pieds de page + pagination ---
      const pageCount = pdf.getNumberOfPages();
      for (let p = 1; p <= pageCount; p += 1) {
        pdf.setPage(p);
        pdf.setTextColor(...PDF.sub);
        pdf.setFontSize(8);
        const footer = [source, today()].filter(Boolean).join("  ·  ");
        pdf.text(footer, margin, pageH - 16);
        pdf.text(`${p} / ${pageCount}`, pageW - margin, pageH - 16, {
          align: "right",
        });
      }

      pdf.save(`${filename}.pdf`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[ExportBar] PDF export failed:", err);
    } finally {
      setBusy(false);
    }
  }, [
    targetRef,
    busy,
    title,
    subtitle,
    source,
    filename,
    unit,
    refValue,
    refLabel,
    year,
    rows,
    labels,
  ]);

  // -------------------------------------------------------- Excel
  const exportExcel = useCallback(async () => {
    if (busy || !rows.length) return;
    setBusy(true);
    try {
      const sorted = [...rows].sort((a, b) => b.value - a.value);
      const vals = sorted.map((r) => r.value);
      const stats = {
        count: sorted.length,
        max: Math.max(...vals),
        min: Math.min(...vals),
        median: median(vals),
        mean: mean(vals),
        top: sorted[0],
        bottom: sorted[sorted.length - 1],
      };

      const wb = new ExcelJS.Workbook();
      wb.creator = "Pacific Dataviz Challenge 2026";
      wb.created = new Date();

      const styleHeader = (cell) => {
        cell.font = { bold: true, color: { argb: C.headerText } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: C.headerBg },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      };

      // ===== Feuille 1 : Classement (année courante) =====
      const ws = wb.addWorksheet(labels.sheet_data || sheet || "Données", {
        views: [{ state: "frozen", ySplit: 4 }],
      });
      ws.columns = [
        { key: "rank", width: 8 },
        { key: "code", width: 10 },
        { key: "name", width: 32 },
        { key: "value", width: 22 },
        { key: "vs", width: 26 },
      ];
      ws.mergeCells("A1:E1");
      Object.assign(ws.getCell("A1"), {
        value: `${title}${year ? ` · ${year}` : ""}`,
      });
      ws.getCell("A1").font = { size: 16, bold: true, color: { argb: C.ink } };
      ws.getRow(1).height = 26;
      ws.mergeCells("A2:E2");
      ws.getCell("A2").value = subtitle;
      ws.getCell("A2").font = {
        size: 10,
        italic: true,
        color: { argb: C.sub },
      };

      const hr = ws.getRow(4);
      hr.values = [
        labels.col_rank || "Rang",
        labels.col_code || "Code",
        labels.col_name || "Territoire",
        labels.col_value || "Valeur",
        labels.col_vs_world || "Écart vs monde",
      ];
      hr.height = 22;
      hr.eachCell(styleHeader);

      const first = 5;
      sorted.forEach((r, i) => {
        const row = ws.getRow(first + i);
        const vs = refValue != null ? r.value - refValue : null;
        row.getCell(1).value = i + 1;
        row.getCell(2).value = r.code || "";
        row.getCell(3).value = r.name;
        row.getCell(4).value = r.value;
        row.getCell(5).value = vs;
        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(4).numFmt = "0.00";
        row.getCell(5).numFmt = "+0.00;[Red]-0.00;0.00";
        row.eachCell((cell, col) => {
          cell.border = { bottom: { style: "hair", color: { argb: C.line } } };
          if (i % 2 === 1 && col <= 5)
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: C.zebra },
            };
        });
      });
      const last = first + sorted.length - 1;
      ws.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4, column: 5 },
      };
      ws.addConditionalFormatting({
        ref: `D${first}:D${last}`,
        rules: [
          {
            type: "colorScale",
            cfvo: [
              { type: "min" },
              { type: "percentile", value: 50 },
              { type: "max" },
            ],
            color: [{ argb: C.low }, { argb: C.mid }, { argb: C.high }],
          },
        ],
      });

      // ===== Feuille 2 : Séries temporelles (matrice) =====
      if (series.length && years.length) {
        const ser = wb.addWorksheet(labels.sheet_series || "Séries", {
          views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
        });
        ser.getColumn(1).width = 10;
        ser.getColumn(2).width = 32;
        years.forEach((_, i) => {
          ser.getColumn(3 + i).width = 9;
        });

        const head = ser.getRow(1);
        head.getCell(1).value = labels.col_code || "Code";
        head.getCell(2).value = labels.col_name || "Territoire";
        years.forEach((y, i) => {
          head.getCell(3 + i).value = y;
        });
        head.height = 20;
        head.eachCell(styleHeader);

        const ranked = [...series].sort((a, b) => {
          const av = a.values[a.values.length - 1]?.value ?? 0;
          const bv = b.values[b.values.length - 1]?.value ?? 0;
          return bv - av;
        });
        ranked.forEach((s, i) => {
          const row = ser.getRow(2 + i);
          row.getCell(1).value = s.code || s.area || "";
          row.getCell(1).alignment = { horizontal: "center" };
          row.getCell(2).value = s.name;
          const byYear = {};
          s.values.forEach((v) => {
            byYear[v.year] = v.value;
          });
          years.forEach((y, j) => {
            const c = row.getCell(3 + j);
            if (byYear[y] != null) {
              c.value = byYear[y];
              c.numFmt = "0.00";
            }
          });
        });
        // Ligne moyenne mondiale (MOBILE)
        const wRow = ser.getRow(2 + ranked.length + 1);
        wRow.getCell(2).value = refLabel || "Moyenne mondiale";
        wRow.getCell(2).font = { bold: true, color: { argb: C.world } };
        years.forEach((y, j) => {
          if (worldByYear[y] != null) {
            const c = wRow.getCell(3 + j);
            c.value = worldByYear[y];
            c.numFmt = "0.00";
            c.font = { bold: true, color: { argb: C.world } };
          }
        });
        // Heatmap temporelle
        const c0 = colLetter(3);
        const c1 = colLetter(2 + years.length);
        ser.addConditionalFormatting({
          ref: `${c0}2:${c1}${1 + ranked.length}`,
          rules: [
            {
              type: "colorScale",
              cfvo: [
                { type: "min" },
                { type: "percentile", value: 50 },
                { type: "max" },
              ],
              color: [{ argb: C.low }, { argb: C.mid }, { argb: C.high }],
            },
          ],
        });
      }

      // ===== Feuille 3 : Synthèse =====
      const sum = wb.addWorksheet(labels.sheet_summary || "Synthèse");
      sum.getColumn(1).width = 34;
      sum.getColumn(2).width = 32;
      sum.mergeCells("A1:B1");
      sum.getCell("A1").value = labels.summary_title || "Synthèse statistique";
      sum.getCell("A1").font = { size: 14, bold: true, color: { argb: C.ink } };
      sum.getRow(1).height = 24;
      const kv = [
        [labels.summary_year || "Année", year],
        [labels.summary_count || "Nombre de territoires", stats.count],
        [
          labels.summary_max || "Maximum",
          `${stats.top?.name} — ${stats.max.toFixed(2)} ${unit}`,
        ],
        [
          labels.summary_min || "Minimum",
          `${stats.bottom?.name} — ${stats.min.toFixed(2)} ${unit}`,
        ],
        [
          labels.summary_median || "Médiane",
          `${stats.median.toFixed(2)} ${unit}`,
        ],
        [
          labels.summary_mean || "Moyenne (Pacifique)",
          `${stats.mean.toFixed(2)} ${unit}`,
        ],
        [
          labels.summary_world || "Moyenne mondiale",
          refValue != null ? `${Number(refValue).toFixed(2)} ${unit}` : "—",
        ],
        [labels.summary_source || "Source", source],
        [labels.summary_generated || "Généré le", today()],
      ];
      kv.forEach(([k, v], i) => {
        const row = sum.getRow(3 + i);
        row.getCell(1).value = k;
        row.getCell(2).value = v;
        row.getCell(1).font = { bold: true, color: { argb: C.sub } };
        row.eachCell((cell) => {
          cell.border = { bottom: { style: "hair", color: { argb: C.line } } };
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      saveAs(
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${filename}.xlsx`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[ExportBar] Excel export failed:", err);
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    rows,
    title,
    subtitle,
    source,
    filename,
    sheet,
    unit,
    refValue,
    refLabel,
    year,
    series,
    years,
    worldByYear,
    labels,
  ]);

  return (
    <div className="export">
      <span className="export__label">{labels.title}</span>
      <button
        type="button"
        className="export__btn"
        onClick={exportPdf}
        disabled={busy || !rows.length}
      >
        {labels.pdf}
      </button>
      <button
        type="button"
        className="export__btn"
        onClick={exportExcel}
        disabled={busy || !rows.length}
      >
        {labels.excel}
      </button>
    </div>
  );
}
