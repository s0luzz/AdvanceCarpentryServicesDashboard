import { jsPDF } from "jspdf";

import { reportFileName, reportFinish, reportHeader } from "./exportBeamReport";

type ReportBeam = { pageNumber: number; lengthMm: number; beamTypeId: string };
type ReportPost = { pageNumber: number; costDollars: number };

export type StructuralReportFile = {
  name: string;
  beams: ReportBeam[];
  posts: ReportPost[];
};

type ReportOptions = {
  client: string;
  address: string;
  beamTypes: { id: string; name: string; kgPerMetre: number }[];
  files: StructuralReportFile[];
  // The takeoff's own steel maths, so the totals match the job's steel cost.
  kgFactor: number;
  ratePerKg: number;
};

type Row = { beam: string; lengthM: number; qty: number; kg: number };

const money = (value: number) =>
  `$${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const kgText = (value: number) =>
  `${value.toLocaleString("en-AU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;

export function exportStructuralReport({ client, address, beamTypes, files, kgFactor, ratePerKg }: ReportOptions) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const columns = { beam: margin, qty: margin + 200, length: margin + 265, weight: margin + 360 };
  const withSteel = files.filter((file) => file.beams.length || file.posts.length);
  const kgOf = (beam: ReportBeam) => {
    const type = beamTypes.find((item) => item.id === beam.beamTypeId);

    return type ? type.kgPerMetre * (beam.lengthMm / 1000) * kgFactor : 0;
  };

  let y = reportHeader(pdf, "Structural steel report", [client, address], margin);
  let totalKg = 0;
  let totalBeams = 0;
  let totalPosts = 0;
  let totalPostCost = 0;

  const ensure = (space: number) => {
    if (y + space > height - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const heading = () => {
    pdf.setFont("helvetica", "bold").setFontSize(10);
    pdf.text("BEAM", columns.beam, y);
    pdf.text("QTY", columns.qty, y);
    pdf.text("LENGTH", columns.length, y);
    pdf.text("WEIGHT", columns.weight, y);
    pdf.setDrawColor(150).line(margin, y + 6, width - margin, y + 6);
    y += 22;
  };

  for (const file of withSteel) {
    const pages = [...new Set([...file.beams, ...file.posts].map((item) => item.pageNumber))].sort((a, b) => a - b);

    for (const page of pages) {
      const beams = file.beams.filter((beam) => beam.pageNumber === page);
      const posts = file.posts.filter((post) => post.pageNumber === page);
      const rows = new Map<string, Row>();

      for (const beam of beams) {
        const name = beamTypes.find((item) => item.id === beam.beamTypeId)?.name ?? "(no type)";
        const lengthM = Math.round(beam.lengthMm / 100) / 10;
        const key = `${name}|${lengthM}`;
        const row = rows.get(key) ?? { beam: name, lengthM, qty: 0, kg: 0 };

        row.qty += 1;
        row.kg += kgOf(beam);
        rows.set(key, row);
      }

      ensure(90);
      pdf.setFont("helvetica", "bold").setFontSize(12);
      pdf.text(withSteel.length > 1 ? `${file.name} - Page ${page}` : `Page ${page}`, margin, y);
      y += 18;
      heading();
      pdf.setFont("helvetica", "normal").setFontSize(12);

      const sorted = [...rows.values()].sort((a, b) => a.beam.localeCompare(b.beam) || b.lengthM - a.lengthM);

      for (const row of sorted) {
        ensure(20);
        pdf.text(row.beam, columns.beam, y);
        pdf.text(`x${row.qty}`, columns.qty, y);
        pdf.text(`@${row.lengthM.toFixed(1)}m`, columns.length, y);
        pdf.text(kgText(row.kg), columns.weight, y);
        y += 20;
      }

      if (posts.length) {
        const cost = posts.reduce((sum, post) => sum + post.costDollars, 0);

        ensure(20);
        pdf.text("Posts", columns.beam, y);
        pdf.text(`x${posts.length}`, columns.qty, y);
        pdf.text(money(cost), columns.weight, y);
        y += 20;
        totalPosts += posts.length;
        totalPostCost += cost;
      }

      totalBeams += beams.length;
      totalKg += beams.reduce((sum, beam) => sum + kgOf(beam), 0);
      y += 10;
    }
  }

  if (withSteel.length === 0) {
    pdf.setFont("helvetica", "normal").setFontSize(12).text("No beams or posts measured on this job.", margin, y);
    y += 20;
  }

  ensure(110);
  pdf.setDrawColor(150).line(margin, y, width - margin, y);
  y += 18;
  pdf.setFont("helvetica", "bold").setFontSize(11);
  [
    `Beams: ${totalBeams}    Total weight: ${kgText(totalKg)}`,
    `Posts: ${totalPosts}    Posts cost: ${money(totalPostCost)}`,
    `Steel cost: ${money(totalKg * ratePerKg + totalPostCost)}`,
  ].forEach((line) => {
    pdf.text(line, margin, y);
    y += 17;
  });
  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(110);
  pdf.text(
    `Weight and cost are counted as in the takeoff: kg/m x length x ${kgFactor}, at ${money(ratePerKg)}/kg, plus posts.`,
    margin,
    y,
  );
  pdf.setTextColor(0);
  y += 22;

  reportFinish(pdf, y, margin, reportFileName(address || client, "Structural steel report"));
}
