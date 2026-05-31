// src/components/ExportBar/ExportBar.jsx
// ============================================================
// Barre d'export PDF / Excel — réutilisable.
// IMPORTANT : l'export ne se déclenche QUE sur clic utilisateur.
// Aucun useEffect → aucune boucle de rendu possible
// (html2canvas est lourd : ne JAMAIS le lancer dans un effet).
// API :
//   targetRef : ref du DOM à capturer pour le PDF
//   rows      : [{ name, value, year }]
//   meta      : { title, subtitle, source, filename, sheet }
//   labels    : { title, pdf, excel, col_name, col_value, col_year }
// ============================================================

import React, { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./ExportBar.scss";

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
    sheet = "Sheet1",
  } = meta;

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
      const margin = 32;
      const availW = pageW - margin * 2;
      const imgH = availW * (canvas.height / canvas.width);

      pdf.setFontSize(14);
      pdf.text(String(title), margin, 40);
      if (subtitle) {
        pdf.setFontSize(10);
        pdf.text(String(subtitle), margin, 58);
      }
      pdf.addImage(img, "PNG", margin, 72, availW, imgH);
      if (source) {
        pdf.setFontSize(8);
        pdf.text(String(source), margin, 72 + imgH + 16);
      }
      pdf.save(`${filename}.pdf`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[ExportBar] PDF export failed:", err);
    } finally {
      setBusy(false);
    }
  }, [targetRef, busy, title, subtitle, source, filename]);

  const exportExcel = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(sheet || "Sheet1");
      ws.columns = [
        { header: labels.col_name || "Name", key: "name", width: 28 },
        { header: labels.col_value || "Value", key: "value", width: 20 },
        { header: labels.col_year || "Year", key: "year", width: 10 },
      ];
      ws.getRow(1).font = { bold: true };
      rows.forEach((r) =>
        ws.addRow({ name: r.name, value: r.value, year: r.year }),
      );

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
  }, [busy, sheet, filename, rows, labels]);

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
