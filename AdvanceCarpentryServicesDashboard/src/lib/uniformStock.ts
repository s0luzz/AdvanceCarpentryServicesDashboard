import { jsPDF } from "jspdf";

import { reportFileName, reportHeader, reportNotes } from "../components/pdf-editor/exportBeamReport";

export const UNIFORM_ITEMS = [
    { key: "singlets", label: "Singlets" },
    { key: "shirts", label: "Shirts" },
    { key: "jumpers", label: "Jumpers" },
] as const;

export const UNIFORM_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"] as const;

export type UniformItem = (typeof UNIFORM_ITEMS)[number]["key"];
export type UniformSize = (typeof UNIFORM_SIZES)[number];
export type UniformStock = Record<UniformItem, Record<UniformSize, number>>;

export const itemTotal = (stock: UniformStock, item: UniformItem) =>
    UNIFORM_SIZES.reduce((sum, size) => sum + stock[item][size], 0);

export function exportUniformReport(stock: UniformStock) {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 48;
    const width = pdf.internal.pageSize.getWidth();
    const labelWidth = 90;
    const cell = (width - margin * 2 - labelWidth) / (UNIFORM_SIZES.length + 1);
    const at = (index: number) => margin + labelWidth + cell * index;
    let y = reportHeader(pdf, "Uniform stock count", [], margin);

    pdf.setFont("helvetica", "bold").setFontSize(10);
    UNIFORM_SIZES.forEach((size, index) => pdf.text(size, at(index), y, { align: "left" }));
    pdf.text("TOTAL", at(UNIFORM_SIZES.length), y);
    pdf.setDrawColor(150).line(margin, y + 6, width - margin, y + 6);
    y += 24;

    pdf.setFontSize(12);
    for (const { key, label } of UNIFORM_ITEMS) {
        pdf.setFont("helvetica", "bold").text(label, margin, y);
        pdf.setFont("helvetica", "normal");
        UNIFORM_SIZES.forEach((size, index) => pdf.text(String(stock[key][size]), at(index), y));
        pdf.setFont("helvetica", "bold").text(String(itemTotal(stock, key)), at(UNIFORM_SIZES.length), y);
        y += 24;
    }

    pdf.setDrawColor(150).line(margin, y - 12, width - margin, y - 12);
    pdf.setFont("helvetica", "bold").setFontSize(11);
    pdf.text(
        `All uniforms: ${UNIFORM_ITEMS.reduce((sum, { key }) => sum + itemTotal(stock, key), 0)}`,
        margin,
        y + 4,
    );

    reportNotes(pdf, y + 30, margin);
    pdf.save(reportFileName(new Date().toLocaleDateString("en-CA"), "Uniform stock"));
}
