// src/components/ExportBar/ExportBar.jsx
// ============================================================
// Export PRO — PDF (rapport multi-pages) + Excel (4 feuilles).
// Sur : export au clic, aucun useEffect -> aucune boucle.
//
// PDF (A4 paysage) :
//   p.1  couverture : bandeau titre/sous-titre + filet accent + date,
//        capture du graphe, bandeau de 5 KPI (n / mediane / max / min / monde)
//   p.2+ CLASSEMENT complet (rang / code / territoire / valeur / ecart),
//        zebra, ecarts colores, ligne de mediane annotee
//   p.N+ SERIES HISTORIQUES completes : matrice territoires x TOUTES les
//        annees, paginee (annees par blocs + lignes par page)
//   pied : source · date · pagination · signature concours
// Excel :
//   "Classement"  annee courante (banniere accent, heatmap, filtre, fige,
//                 lignes mediane/moyenne en pied)
//   "Series"      matrice territoires x annees + moyenne mondiale (mobile),
//                 heatmap temporelle, fige
//   "Synthese"    statistiques cle/valeur
//   "Lisez-moi"   methode + source + licence
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
import { useLang } from "../../store/context/langContext";
import "./ExportBar.scss";

// Palette Excel (ARGB)
const C = {
  ink: "FF0B1E2D",
  band: "FF0E2A3F",
  accent: "FF0096B4",
  headerText: "FFFFFFFF",
  sub: "FF5B6B7A",
  line: "FFE3E8EF",
  zebra: "FFF5F8FB",
  low: "FF1F9BC9",
  mid: "FFFFD166",
  high: "FFFF5A36",
  world: "FFFF5A36",
  foot: "FFEAF4F8",
};
// Palette PDF (RGB)
const PDF = {
  ink: [15, 30, 45],
  sub: [100, 116, 130],
  band: [10, 26, 40],
  accent: [0, 150, 180],
  white: [255, 255, 255],
  line: [214, 224, 233],
  zebra: [244, 248, 251],
  pos: [196, 70, 80],
  neg: [30, 120, 160],
  kpi: [243, 248, 251],
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
const SIGN = "Pacific Dataviz Challenge 2026";

// Copie de la feuille "Lisez-moi" (i18n interne, sans toucher fr/en.json)
const READMES = {
  fr: {
    sheet: "Lisez-moi",
    title: "Lisez-moi — methode & sources",
    l1: "Donnees du Pacifique : valeurs officielles par habitant (Pacific Data Hub).",
    l2: "Les comparaisons mondiales proviennent de World Bank Data360 / Our World in Data (CC BY 4.0).",
    l3: "Reference de lecture : la mediane du Pacifique (robuste face aux valeurs extremes).",
  },
  en: {
    sheet: "Read me",
    title: "Read me — method & sources",
    l1: "Pacific data: official per-capita values (Pacific Data Hub).",
    l2: "Global comparisons come from World Bank Data360 / Our World in Data (CC BY 4.0).",
    l3: "Reading reference: the Pacific median (robust to outliers).",
  },
};

export default function ExportBar({
  targetRef,
  rows = [],
  meta = {},
  labels = {},
}) {
  const { lang } = useLang();
  const RM = READMES[lang] || READMES.fr;
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

  // ======================================================== PDF
  const exportPdf = useCallback(async () => {
    const node = targetRef && targetRef.current;
    if (busy) return;
    setBusy(true);
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 36;
      const fullW = pageW - margin * 2;

      const bandTitle = (txt, sub) => {
        pdf.setFillColor(...PDF.band);
        pdf.rect(0, 0, pageW, 52, "F");
        pdf.setFillColor(...PDF.accent);
        pdf.rect(0, 52, pageW, 3, "F");
        pdf.setTextColor(...PDF.white);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(15);
        pdf.text(String(txt), margin, 30);
        if (sub) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.text(String(sub), margin, 44);
        }
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(today(), pageW - margin, 30, { align: "right" });
      };

      // ---- Page 1 : couverture ----
      bandTitle(title, subtitle);
      let cursorY = 78;

      if (node) {
        try {
          const canvas = await html2canvas(node, {
            backgroundColor: "#0b1e2d",
            scale: 2,
            useCORS: true,
            logging: false,
          });
          const img = canvas.toDataURL("image/png");
          const availW = fullW;
          const maxH = pageH - cursorY - 110;
          let w = availW;
          let h = availW * (canvas.height / canvas.width);
          if (h > maxH) {
            h = maxH;
            w = maxH * (canvas.width / canvas.height);
          }
          const ix = margin + (fullW - w) / 2;
          pdf.addImage(img, "PNG", ix, cursorY, w, h);
          cursorY += h + 22;
        } catch (e) {
          // capture optionnelle : on continue sans image
        }
      }

      // ---- Bandeau de KPI ----
      const vals = rows.map((r) => r.value).filter((v) => Number.isFinite(v));
      if (vals.length) {
        const kpis = [
          [labels.summary_count || "Territoires", String(vals.length)],
          [labels.summary_median || "Mediane", `${median(vals).toFixed(2)} ${unit}`],
          [labels.summary_max || "Maximum", `${Math.max(...vals).toFixed(2)} ${unit}`],
          [labels.summary_min || "Minimum", `${Math.min(...vals).toFixed(2)} ${unit}`],
          [
            refLabel || labels.summary_world || "Reference",
            refValue != null ? `${Number(refValue).toFixed(2)} ${unit}` : "—",
          ],
        ];
        const gap = 10;
        const bw = (fullW - gap * (kpis.length - 1)) / kpis.length;
        const bh = 46;
        const by = Math.min(cursorY, pageH - 96);
        kpis.forEach(([k, v], i) => {
          const bx = margin + i * (bw + gap);
          pdf.setFillColor(...PDF.kpi);
          pdf.roundedRect(bx, by, bw, bh, 4, 4, "F");
          pdf.setFillColor(...PDF.accent);
          pdf.rect(bx, by, 3, bh, "F");
          pdf.setTextColor(...PDF.sub);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.5);
          pdf.text(String(k).toUpperCase(), bx + 10, by + 16);
          pdf.setTextColor(...PDF.ink);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(13);
          pdf.text(String(v), bx + 10, by + 36);
        });
      }

      // ---- Classement complet ----
      if (rows.length) {
        const sorted = [...rows].sort((a, b) => b.value - a.value);
        const head = [
          labels.col_rank || "#",
          labels.col_code || "Code",
          labels.col_name || "Territoire",
          `${labels.col_value || "Valeur"}${unit ? ` (${unit})` : ""}`,
          labels.col_vs_world || "Ecart",
        ];
        const colW = [44, 70, 320, 150, fullW - 584];
        const aligns = ["center", "center", "left", "right", "right"];
        const xs = [];
        let tx = margin;
        colW.forEach((w) => {
          xs.push(tx);
          tx += w;
        });
        const rowH = 18;
        const med = median(vals);

        const newTablePage = () => {
          pdf.addPage();
          bandTitle(`${title} — ${labels.sheet_data || "Classement"} ${year}`);
          let y = 78;
          pdf.setFillColor(...PDF.band);
          pdf.rect(margin, y - 13, fullW, rowH, "F");
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
            pdf.text(String(hd), x, y, { align: aligns[i] });
          });
          return y + rowH;
        };

        let ty = newTablePage();
        pdf.setFont("helvetica", "normal");
        sorted.forEach((r, i) => {
          if (ty > pageH - 46) ty = newTablePage();
          if (i % 2 === 1) {
            pdf.setFillColor(...PDF.zebra);
            pdf.rect(margin, ty - 13, fullW, rowH, "F");
          }
          const vs = refValue != null ? r.value - refValue : null;
          const cells = [
            String(i + 1),
            r.code || "",
            r.name || "",
            Number(r.value).toFixed(2),
            vs == null ? "—" : vs > 0 ? `+${vs.toFixed(2)}` : vs.toFixed(2),
          ];
          cells.forEach((cell, ci) => {
            pdf.setTextColor(
              ...(ci === 4 && vs != null
                ? vs > 0
                  ? PDF.pos
                  : PDF.neg
                : PDF.ink),
            );
            pdf.setFontSize(9);
            const x =
              aligns[ci] === "right"
                ? xs[ci] + colW[ci] - 6
                : aligns[ci] === "center"
                  ? xs[ci] + colW[ci] / 2
                  : xs[ci] + 6;
            pdf.text(String(cell), x, ty, { align: aligns[ci] });
          });
          pdf.setDrawColor(...PDF.line);
          pdf.line(margin, ty + 4, margin + fullW, ty + 4);
          ty += rowH;
        });

        if (refValue != null) {
          pdf.setTextColor(...PDF.sub);
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(8);
          pdf.text(
            `${refLabel || "Reference"} : ${Number(refValue).toFixed(2)} ${unit}  ·  ${
              labels.summary_median || "Mediane"
            } : ${med.toFixed(2)} ${unit}`,
            margin,
            ty + 12,
          );
        }
      }

      // ---- Series historiques completes (toutes les annees) ----
      if (series.length && years.length) {
        const ranked = [...series].sort((a, b) => {
          const av = a.values[a.values.length - 1]?.value ?? 0;
          const bv = b.values[b.values.length - 1]?.value ?? 0;
          return bv - av;
        });
        const byYear = ranked.map((s) => {
          const m = {};
          s.values.forEach((v) => {
            m[v.year] = v.value;
          });
          return { code: s.code || s.area || "", name: s.name, m };
        });

        const CODE_W = 44;
        const NAME_W = 168;
        const YEAR_W = 34;
        const perPage = Math.max(1, Math.floor((fullW - CODE_W - NAME_W) / YEAR_W));

        for (let c = 0; c < years.length; c += perPage) {
          const yrs = years.slice(c, c + perPage);
          const tw = CODE_W + NAME_W + yrs.length * YEAR_W;
          const rowH = 16;

          const header = () => {
            pdf.addPage();
            bandTitle(
              `${title} — ${labels.sheet_series || "Series"} ${yrs[0]}–${yrs[yrs.length - 1]} (${unit})`,
            );
            let y = 78;
            pdf.setFillColor(...PDF.band);
            pdf.rect(margin, y - 12, tw, rowH, "F");
            pdf.setTextColor(...PDF.white);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8);
            pdf.text(labels.col_code || "Code", margin + 6, y);
            pdf.text(labels.col_name || "Territoire", margin + CODE_W + 6, y);
            yrs.forEach((yy, i) => {
              const x = margin + CODE_W + NAME_W + i * YEAR_W + YEAR_W - 4;
              pdf.text(String(yy), x, y, { align: "right" });
            });
            return y + rowH;
          };

          let ty = header();
          pdf.setFont("helvetica", "normal");
          byYear.forEach((r, ri) => {
            if (ty > pageH - 46) ty = header();
            if (ri % 2 === 1) {
              pdf.setFillColor(...PDF.zebra);
              pdf.rect(margin, ty - 12, tw, rowH, "F");
            }
            pdf.setTextColor(...PDF.ink);
            pdf.setFontSize(8);
            pdf.text(String(r.code), margin + 6, ty);
            pdf.setFontSize(7.5);
            const nm = r.name && r.name.length > 32 ? `${r.name.slice(0, 31)}…` : r.name;
            pdf.text(String(nm || ""), margin + CODE_W + 6, ty);
            pdf.setFontSize(7);
            yrs.forEach((yy, i) => {
              const v = r.m[yy];
              if (v == null) return;
              const x = margin + CODE_W + NAME_W + i * YEAR_W + YEAR_W - 4;
              pdf.text(Number(v).toFixed(1), x, ty, { align: "right" });
            });
            ty += rowH;
          });
        }
      }

      // ---- Pieds de page + pagination ----
      const pageCount = pdf.getNumberOfPages();
      for (let p = 1; p <= pageCount; p += 1) {
        pdf.setPage(p);
        pdf.setDrawColor(...PDF.line);
        pdf.line(margin, pageH - 26, pageW - margin, pageH - 26);
        pdf.setTextColor(...PDF.sub);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        const footer = [source, SIGN].filter(Boolean).join("   ·   ");
        pdf.text(footer, margin, pageH - 14);
        pdf.text(`${p} / ${pageCount}`, pageW - margin, pageH - 14, {
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
    series,
    years,
    labels,
  ]);

  // ======================================================== Excel
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
      wb.creator = SIGN;
      wb.created = new Date();

      const banner = (ws, span, ttl, sub) => {
        ws.mergeCells(`A1:${colLetter(span)}1`);
        const a1 = ws.getCell("A1");
        a1.value = ttl;
        a1.font = { size: 15, bold: true, color: { argb: C.headerText } };
        a1.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        a1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.band } };
        ws.getRow(1).height = 28;
        ws.mergeCells(`A2:${colLetter(span)}2`);
        const a2 = ws.getCell("A2");
        a2.value = sub || "";
        a2.font = { size: 10, italic: true, color: { argb: C.sub } };
        a2.alignment = { indent: 1 };
        ws.getRow(2).height = 16;
        ws.mergeCells(`A3:${colLetter(span)}3`);
        ws.getCell("A3").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: C.accent },
        };
        ws.getRow(3).height = 3;
      };
      const styleHeader = (cell) => {
        cell.font = { bold: true, color: { argb: C.headerText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.band } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      };

      // ===== Feuille 1 : Classement (annee courante) =====
      const ws = wb.addWorksheet(labels.sheet_data || sheet || "Classement", {
        views: [{ state: "frozen", ySplit: 5 }],
      });
      ws.columns = [
        { key: "rank", width: 8 },
        { key: "code", width: 10 },
        { key: "name", width: 34 },
        { key: "value", width: 18 },
        { key: "vs", width: 22 },
      ];
      banner(ws, 5, `${title}${year ? ` · ${year}` : ""}`, subtitle);

      const hr = ws.getRow(5);
      hr.values = [
        labels.col_rank || "Rang",
        labels.col_code || "Code",
        labels.col_name || "Territoire",
        `${labels.col_value || "Valeur"}${unit ? ` (${unit})` : ""}`,
        labels.col_vs_world || "Ecart",
      ];
      hr.height = 22;
      hr.eachCell(styleHeader);

      const first = 6;
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

      // Pied : mediane + moyenne
      const footMed = ws.getRow(last + 2);
      footMed.getCell(3).value = labels.summary_median || "Mediane";
      footMed.getCell(4).value = stats.median;
      const footAvg = ws.getRow(last + 3);
      footAvg.getCell(3).value = labels.summary_mean || "Moyenne";
      footAvg.getCell(4).value = stats.mean;
      [footMed, footAvg].forEach((rw) => {
        rw.getCell(3).font = { bold: true, color: { argb: C.sub } };
        rw.getCell(4).numFmt = "0.00";
        rw.getCell(4).font = { bold: true, color: { argb: C.ink } };
        rw.getCell(3).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: C.foot },
        };
        rw.getCell(4).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: C.foot },
        };
      });

      ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: 5 } };
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

      // ===== Feuille 2 : Series temporelles (matrice complete) =====
      if (series.length && years.length) {
        const ser = wb.addWorksheet(labels.sheet_series || "Series", {
          views: [{ state: "frozen", xSplit: 2, ySplit: 4 }],
        });
        ser.getColumn(1).width = 10;
        ser.getColumn(2).width = 32;
        years.forEach((_, i) => {
          ser.getColumn(3 + i).width = 9;
        });
        banner(ser, 2 + years.length, `${title} — ${labels.sheet_series || "Series"}`, subtitle);

        const head = ser.getRow(4);
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
        const firstS = 5;
        ranked.forEach((s, i) => {
          const row = ser.getRow(firstS + i);
          row.getCell(1).value = s.code || s.area || "";
          row.getCell(1).alignment = { horizontal: "center" };
          row.getCell(2).value = s.name;
          const m = {};
          s.values.forEach((v) => {
            m[v.year] = v.value;
          });
          years.forEach((y, j) => {
            const c = row.getCell(3 + j);
            if (m[y] != null) {
              c.value = m[y];
              c.numFmt = "0.00";
            }
          });
          if (i % 2 === 1)
            row.eachCell((cell) => {
              if (!cell.fill || cell.fill.type !== "pattern")
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: C.zebra },
                };
            });
        });

        // Ligne moyenne mondiale (MOBILE)
        const wRow = ser.getRow(firstS + ranked.length + 1);
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

        const c0 = colLetter(3);
        const c1 = colLetter(2 + years.length);
        ser.addConditionalFormatting({
          ref: `${c0}${firstS}:${c1}${firstS - 1 + ranked.length}`,
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

      // ===== Feuille 3 : Synthese =====
      const sum = wb.addWorksheet(labels.sheet_summary || "Synthese");
      sum.getColumn(1).width = 34;
      sum.getColumn(2).width = 34;
      banner(sum, 2, labels.summary_title || "Synthese statistique", subtitle);
      const kv = [
        [labels.summary_year || "Annee", year],
        [labels.summary_count || "Nombre de territoires", stats.count],
        [
          labels.summary_max || "Maximum",
          `${stats.top?.name} — ${stats.max.toFixed(2)} ${unit}`,
        ],
        [
          labels.summary_min || "Minimum",
          `${stats.bottom?.name} — ${stats.min.toFixed(2)} ${unit}`,
        ],
        [labels.summary_median || "Mediane", `${stats.median.toFixed(2)} ${unit}`],
        [labels.summary_mean || "Moyenne", `${stats.mean.toFixed(2)} ${unit}`],
        [
          labels.summary_world || "Reference",
          refValue != null ? `${Number(refValue).toFixed(2)} ${unit}` : "—",
        ],
        [labels.summary_source || "Source", source],
        [labels.summary_generated || "Genere le", today()],
      ];
      kv.forEach(([k, v], i) => {
        const row = sum.getRow(5 + i);
        row.getCell(1).value = k;
        row.getCell(2).value = v;
        row.getCell(1).font = { bold: true, color: { argb: C.sub } };
        row.eachCell((cell) => {
          cell.border = { bottom: { style: "hair", color: { argb: C.line } } };
        });
      });

      // ===== Feuille 4 : Lisez-moi =====
      const rm = wb.addWorksheet(RM.sheet);
      rm.getColumn(1).width = 100;
      banner(rm, 1, RM.title, "");
      const notes = [
        RM.l1,
        RM.l2,
        RM.l3,
        `${labels.summary_source || "Source"} : ${source}`,
        `${labels.summary_generated || "Genere le"} : ${today()} — ${SIGN}`,
      ];
      notes.forEach((n, i) => {
        const cell = rm.getCell(`A${5 + i}`);
        cell.value = n;
        cell.alignment = { wrapText: true, vertical: "top" };
        cell.font = { color: { argb: C.ink } };
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
    RM,
  ]);

  return (
    <div className="export">
      <span className="export__label">{labels.title}</span>
      <button
        type="button"
        className="export__btn export__btn--pdf"
        onClick={exportPdf}
        disabled={busy || !rows.length}
      >
        {busy ? "…" : labels.pdf}
      </button>
      <button
        type="button"
        className="export__btn export__btn--xls"
        onClick={exportExcel}
        disabled={busy || !rows.length}
      >
        {busy ? "…" : labels.excel}
      </button>
    </div>
  );
}