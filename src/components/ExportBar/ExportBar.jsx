// src/components/ExportBar/ExportBar.jsx
// ============================================================
// Barre d'export PDF / Excel — niveau analyste, sûr (clic only,
// aucun useEffect → aucune boucle de rendu).
//
// PDF  : titre + sous-titre + capture du graphe + source/date.
// Excel: classeur 2 feuilles via toute la puissance d'ExcelJS —
//   • "Données"  : classement, code, valeur, écart vs moyenne mondiale,
//                  heatmap (mise en forme conditionnelle), en-tête figé,
//                  filtre auto, formats numériques, bordures.
//   • "Synthèse" : année, n, max/min/médiane/moyenne, moyenne mondiale,
//                  source, date de génération.
//
// API :
//   targetRef : ref du DOM capturé pour le PDF
//   rows      : [{ name, code, value, year }]
//   meta      : { title, subtitle, source, filename, sheet, unit,
//                 refValue, refLabel, year }
//   labels    : { title, pdf, excel, col_rank, col_code, col_name,
//                 col_value, col_vs_world, sheet_data, sheet_summary,
//                 summary_title, summary_year, summary_count, summary_max,
//                 summary_min, summary_median, summary_mean, summary_world,
//                 summary_source, summary_generated }
// ============================================================

import React, { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./ExportBar.scss";

// --- Palette (cohérente avec la dataviz) ---
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
};

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (arr) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const today = () => new Date().toISOString().slice(0, 10);

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
  } = meta;

  // ---------------------------------------------------------- PDF
  const exportPdf = useCallback(async () => {
    const node = targetRef && targetRef.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(node, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const img = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 36;
      const availW = pageW - margin * 2;
      const imgH = availW * (canvas.height / canvas.width);

      pdf.setTextColor(11, 30, 45);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text(String(title), margin, 42);
      if (subtitle) {
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(91, 107, 122);
        pdf.setFontSize(10);
        pdf.text(String(subtitle), margin, 60);
      }
      pdf.addImage(img, "PNG", margin, 76, availW, imgH);

      pdf.setFontSize(8);
      pdf.setTextColor(120, 130, 140);
      const footer = [source, `${today()}`].filter(Boolean).join("  ·  ");
      pdf.text(footer, margin, 76 + imgH + 16);

      pdf.save(`${filename}.pdf`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[ExportBar] PDF export failed:", err);
    } finally {
      setBusy(false);
    }
  }, [targetRef, busy, title, subtitle, source, filename]);

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

      // ===================== Feuille DONNÉES =====================
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

      // Bandeau titre
      ws.mergeCells("A1:E1");
      const tCell = ws.getCell("A1");
      tCell.value = title;
      tCell.font = { size: 16, bold: true, color: { argb: C.ink } };
      tCell.alignment = { vertical: "middle" };
      ws.getRow(1).height = 26;

      ws.mergeCells("A2:E2");
      const sCell = ws.getCell("A2");
      sCell.value = subtitle;
      sCell.font = { size: 10, italic: true, color: { argb: C.sub } };

      // En-tête (ligne 4)
      const headerRow = ws.getRow(4);
      headerRow.values = [
        labels.col_rank || "Rang",
        labels.col_code || "Code",
        labels.col_name || "Territoire",
        labels.col_value || "Valeur",
        labels.col_vs_world || "Écart vs moyenne mondiale",
      ];
      headerRow.height = 22;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: C.headerText } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: C.headerBg },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          bottom: { style: "thin", color: { argb: C.headerBg } },
        };
      });

      // Données
      const firstDataRow = 5;
      sorted.forEach((r, i) => {
        const rowIdx = firstDataRow + i;
        const row = ws.getRow(rowIdx);
        const vs = refValue != null ? r.value - refValue : null;
        row.getCell(1).value = i + 1;
        row.getCell(2).value = r.code || r.area || "";
        row.getCell(3).value = r.name;
        row.getCell(4).value = r.value;
        row.getCell(5).value = vs;

        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(4).numFmt = "0.00";
        row.getCell(5).numFmt = "+0.00;[Red]-0.00;0.00";

        row.eachCell((cell, col) => {
          cell.border = {
            bottom: { style: "hair", color: { argb: C.line } },
          };
          if (i % 2 === 1 && col <= 5) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: C.zebra },
            };
          }
        });
      });

      const lastDataRow = firstDataRow + sorted.length - 1;

      // Ligne "moyenne mondiale" (repère)
      if (refValue != null) {
        const refRow = ws.getRow(lastDataRow + 2);
        refRow.getCell(3).value = refLabel || "Moyenne mondiale";
        refRow.getCell(4).value = refValue;
        refRow.getCell(4).numFmt = "0.00";
        refRow.getCell(3).font = { bold: true, color: { argb: C.high } };
        refRow.getCell(4).font = { bold: true, color: { argb: C.high } };
      }

      // Filtre auto + heatmap (mise en forme conditionnelle) sur la valeur
      ws.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4, column: 5 },
      };
      ws.addConditionalFormatting({
        ref: `D${firstDataRow}:D${lastDataRow}`,
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
      // (Barres de données retirées : la règle dataBar d'ExcelJS exige des
      //  cfvo et plante sinon. La heatmap color-scale ci-dessus suffit.)

      // ===================== Feuille SYNTHÈSE =====================
      const sum = wb.addWorksheet(labels.sheet_summary || "Synthèse");
      sum.columns = [
        { key: "k", width: 34 },
        { key: "v", width: 30 },
      ];
      sum.mergeCells("A1:B1");
      const sumTitle = sum.getCell("A1");
      sumTitle.value = labels.summary_title || "Synthèse statistique";
      sumTitle.font = { size: 14, bold: true, color: { argb: C.ink } };
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
        row.getCell(1).alignment = { vertical: "middle" };
        row.getCell(2).alignment = { vertical: "middle" };
        row.eachCell((cell) => {
          cell.border = { bottom: { style: "hair", color: { argb: C.line } } };
        });
      });

      // ===================== Écriture =====================
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
