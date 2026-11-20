import { jsPDF } from "jspdf";

import type { DimensionMarkup } from "./editorTypes";

type ReportOptions = {
  client: string;
  address: string;
  dimensions: DimensionMarkup[];
};

// typed = the length typed in the dimension box; as-typed = text we can't read
// as a length (shown exactly as written); none = nothing typed, measured length.
export type BeamGroup = "typed" | "as-typed" | "none";

export type BeamRow = {
  group: BeamGroup;
  beam: string;
  colour: string;
  length: string; // as shown in the report
  sortM: number;
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

const METRES = /^\d+[.,]\d+$/;
const MILLIMETRES = /^\d{4}$/;
const BEAM_AND_LENGTH = /^(.+?)\s+(\d+[.,]\d+)$/;

const metres = (value: number) => `@${value.toFixed(1)}m`;

function read(dimension: DimensionMarkup): Pick<BeamRow, "group" | "beam" | "length" | "sortM"> {
  const label = dimension.label.trim() || "(no label)";
  const text = dimension.displayText.trim();
  const typed = (beam: string, value: number) => ({
    group: "typed" as const,
    beam,
    length: metres(value),
    sortM: value,
  });

  if (text === "") {
    const measured = Math.round(dimension.measuredMm / 100) / 10;

    return { group: "none", beam: label, length: `${metres(measured)} measured`, sortM: measured };
  }

  if (METRES.test(text)) {
    return typed(label, Number(text.replace(",", ".")));
  }

  if (MILLIMETRES.test(text)) {
    return typed(label, Number(text) / 1000);
  }

  const both = BEAM_AND_LENGTH.exec(text);

  if (both) {
    return typed(both[1].trim(), Number(both[2].replace(",", ".")));
  }

  return { group: "as-typed", beam: label, length: text, sortM: 0 };
}

// One row per beam + colour + length, with a count.
export function beamRows(dimensions: DimensionMarkup[]): BeamRow[] {
  const rows = new Map<string, BeamRow>();

  for (const dimension of dimensions) {
    const colour = dimension.lineColor.toLowerCase();
    const found = read(dimension);
    const key = [found.group, found.beam, colour, found.length].join("|");
    const row = rows.get(key);

    if (row) {
      row.qty += 1;
    } else {
      rows.set(key, { ...found, colour, qty: 1 });
    }
  }

  return [...rows.values()].sort(
    (a, b) =>
      a.beam.localeCompare(b.beam) ||
      a.colour.localeCompare(b.colour) ||
      b.sortM - a.sortM ||
      a.length.localeCompare(b.length),
  );
}

const GROUP_TITLES: Record<BeamGroup, string> = {
  typed: "",
  "as-typed": "Written as typed (check these)",
  none: "No length entered (measured length shown)",
};

export function exportBeamReport({ client, address, dimensions }: ReportOptions) {
  const rows = beamRows(dimensions);
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const columns = { beam: margin, qty: margin + 200, length: margin + 265, colour: margin + 400 };
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

  for (const group of ["typed", "as-typed", "none"] as const) {
    const inGroup = rows.filter((row) => row.group === group);

    if (inGroup.length === 0) {
      continue;
    }

    if (GROUP_TITLES[group]) {
      y += 8;
      pdf.setFont("helvetica", "bold").setFontSize(10).text(GROUP_TITLES[group], margin, y);
      y += 18;
      pdf.setFont("helvetica", "normal").setFontSize(12);
    }

    for (const row of inGroup) {
      if (y > height - margin) {
        pdf.addPage();
        y = margin;
        heading();
        pdf.setFont("helvetica", "normal").setFontSize(12);
      }

      pdf.text(row.beam, columns.beam, y);
      pdf.text(`x${row.qty}`, columns.qty, y);
      pdf.text(row.length, columns.length, y);

      const [r, g, b] = rgb(row.colour);

      pdf.setFillColor(r, g, b).setDrawColor(120).rect(columns.colour, y - 9, 11, 11, "FD");
      pdf.text(colourName(row.colour), columns.colour + 18, y);
      y += 20;
    }
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
