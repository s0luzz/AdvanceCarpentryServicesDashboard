import { jsPDF } from "jspdf";

import type { DimensionMarkup } from "./editorTypes";

type ReportOptions = {
  client: string;
  address: string;
  dimensions: DimensionMarkup[];
};

export type BeamRow = {
  beam: string;
  colour: string;
  lengthM: number;
  qty: number;
};

const NAMED_COLOURS: [string, [number, number, number]][] = [
  ["Red", [220, 38, 38]],
  ["Blue", [0, 57, 179]],
  ["Yellow", [253, 224, 71]],
  ["Green", [22, 163, 74]],
  ["Orange", [249, 115, 22]],
  ["Purple", [147, 51, 234]],
  ["Pink", [236, 72, 153]],
  ["Black", [17, 24, 39]],
  ["Grey", [128, 128, 128]],
  ["White", [255, 255, 255]],
];

function rgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");

  return [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16) || 0) as [number, number, number];
}

export function colourName(hex: string) {
  const colour = rgb(hex);
  const distance = ([, named]: [string, [number, number, number]]) =>
    named.reduce((sum, channel, index) => sum + (channel - colour[index]) ** 2, 0);

  return NAMED_COLOURS.reduce((best, item) => (distance(item) < distance(best) ? item : best))[0];
}

// One row per beam + colour + length (to the nearest 0.1 m), with a count.
export function beamRows(dimensions: DimensionMarkup[]): BeamRow[] {
  const rows = new Map<string, BeamRow>();

  for (const dimension of dimensions) {
    const beam = dimension.label.trim() || "(no label)";
    const colour = dimension.lineColor.toLowerCase();
    const lengthM = Math.round(dimension.measuredMm / 100) / 10;
    const key = `${beam}|${colour}|${lengthM}`;
    const row = rows.get(key);

    if (row) {
      row.qty += 1;
    } else {
      rows.set(key, { beam, colour, lengthM, qty: 1 });
    }
  }

  return [...rows.values()].sort(
    (a, b) => a.beam.localeCompare(b.beam) || a.colour.localeCompare(b.colour) || b.lengthM - a.lengthM,
  );
}

export function exportBeamReport({ client, address, dimensions }: ReportOptions) {
  const rows = beamRows(dimensions);
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const columns = { beam: margin, qty: margin + 200, length: margin + 270, colour: margin + 360 };
  let y = margin;

  pdf.setFont("helvetica", "bold").setFontSize(18).text("Beam report", margin, y);
  y += 22;
  pdf.setFont("helvetica", "normal").setFontSize(11);
  [client, address, new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })]
    .filter(Boolean)
    .forEach((line) => {
      pdf.text(line, margin, y);
      y += 15;
    });
  y += 12;

  const heading = () => {
    pdf.setFont("helvetica", "bold").setFontSize(10);
    pdf.text("BEAM", columns.beam, y);
    pdf.text("QTY", columns.qty, y);
    pdf.text("LENGTH", columns.length, y);
    pdf.text("COLOUR", columns.colour, y);
    pdf.setDrawColor(150).line(margin, y + 6, width - margin, y + 6);
    y += 22;
  };

  heading();
  pdf.setFont("helvetica", "normal").setFontSize(12);

  for (const row of rows) {
    if (y > height - margin) {
      pdf.addPage();
      y = margin;
      heading();
      pdf.setFont("helvetica", "normal").setFontSize(12);
    }

    pdf.text(row.beam, columns.beam, y);
    pdf.text(`x${row.qty}`, columns.qty, y);
    pdf.text(`@${row.lengthM.toFixed(1)}m`, columns.length, y);

    const [r, g, b] = rgb(row.colour);

    pdf.setFillColor(r, g, b).setDrawColor(120).rect(columns.colour, y - 9, 11, 11, "FD");
    pdf.text(colourName(row.colour), columns.colour + 18, y);
    y += 20;
  }

  if (rows.length === 0) {
    pdf.text("No beams marked on this page.", margin, y);
    y += 20;
  }

  pdf.setFont("helvetica", "bold").setFontSize(10);
  pdf.text(`Total: ${dimensions.length} piece${dimensions.length === 1 ? "" : "s"}`, margin, y + 4);
  y += 30;

  // Notes box, with writing lines.
  const notesHeight = Math.max(Math.min(height - margin - y, 170), 60);

  if (y + notesHeight > height - margin) {
    pdf.addPage();
    y = margin;
  }

  pdf.text("Notes", margin, y);
  pdf.setDrawColor(150).rect(margin, y + 8, width - margin * 2, notesHeight);

  for (let line = y + 36; line < y + 8 + notesHeight; line += 24) {
    pdf.setDrawColor(210).line(margin + 8, line, width - margin - 8, line);
  }

  const name = (address || client || "Job").replace(/[\\/:*?"<>|]+/g, "");

  pdf.save(`${name} - Beam report.pdf`);
}
