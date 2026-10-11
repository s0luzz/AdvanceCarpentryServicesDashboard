import { jsPDF } from "jspdf";

import {
    DAY_LETTERS,
    DAYS_PER_WEEK,
    addDays,
    formatDate,
    weekLabel,
} from "./scheduleUtils";

export type SchedulePdfRow = {
    label: string;
    startCol: number;
    endCol: number;
};

type ExportSchedulePdfOptions = {
    monday: Date;
    weeks: number;
    rows: SchedulePdfRow[];
};

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 28;
const LABEL_WIDTH = 150;
const WEEK_ROW_HEIGHT = 24;
const DAY_ROW_HEIGHT = 20;
const MIN_ROWS = 10;
const BLOCK_COLOUR = "#4f6bff";

// Mirrors the Canva sheet: week bands, M-S columns, address labels, blue blocks.
export function exportSchedulePdf({
    monday,
    weeks,
    rows,
}: ExportSchedulePdfOptions) {
    const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: [PAGE_WIDTH, PAGE_HEIGHT],
    });

    const columns = weeks * DAYS_PER_WEEK;
    const gridLeft = MARGIN + LABEL_WIDTH;
    const columnWidth = (PAGE_WIDTH - MARGIN - gridLeft) / columns;
    const top = MARGIN + 14;
    const rowCount = Math.max(rows.length, MIN_ROWS);
    const rowHeight = Math.min(
        46,
        (PAGE_HEIGHT - MARGIN - top - WEEK_ROW_HEIGHT - DAY_ROW_HEIGHT) /
            rowCount,
    );
    const rowsTop = top + WEEK_ROW_HEIGHT + DAY_ROW_HEIGHT;

    pdf.setDrawColor(0);
    pdf.setTextColor(0);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Advance Carpentry Services - Schedule", MARGIN, MARGIN);

    // Week bands.
    pdf.setLineWidth(1.2);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    for (let week = 0; week < weeks; week += 1) {
        const x = gridLeft + week * DAYS_PER_WEEK * columnWidth;
        const width = DAYS_PER_WEEK * columnWidth;
        pdf.rect(x, top, width, WEEK_ROW_HEIGHT);
        pdf.text(
            weekLabel(addDays(monday, week * 7)),
            x + width / 2,
            top + WEEK_ROW_HEIGHT / 2,
            { align: "center", baseline: "middle" },
        );
    }

    // Day letters.
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);

    for (let col = 0; col < columns; col += 1) {
        const x = gridLeft + col * columnWidth;
        pdf.setLineWidth(col % DAYS_PER_WEEK === 0 ? 1.2 : 0.6);
        pdf.rect(x, top + WEEK_ROW_HEIGHT, columnWidth, DAY_ROW_HEIGHT);
        pdf.text(
            DAY_LETTERS[col % DAYS_PER_WEEK],
            x + columnWidth / 2,
            top + WEEK_ROW_HEIGHT + DAY_ROW_HEIGHT / 2,
            { align: "center", baseline: "middle" },
        );
    }

    // Rows (blank rows pad it out to at least MIN_ROWS like the Canva sheet).
    for (let index = 0; index < rowCount; index += 1) {
        const row = rows[index];
        const y = rowsTop + index * rowHeight;

        pdf.setLineWidth(1.2);
        pdf.rect(MARGIN, y, LABEL_WIDTH, rowHeight);

        pdf.setLineWidth(0.6);
        for (let col = 0; col < columns; col += 1) {
            pdf.rect(gridLeft + col * columnWidth, y, columnWidth, rowHeight);
        }

        if (!row) {
            continue;
        }

        const first = Math.max(row.startCol, 0);
        const last = Math.min(row.endCol, columns - 1);

        // One filled cell per day so the dividers show through, like the Canva sheet.
        pdf.setFillColor(BLOCK_COLOUR);
        pdf.setLineWidth(1.2);
        for (let col = first; col <= last; col += 1) {
            pdf.rect(
                gridLeft + col * columnWidth,
                y,
                columnWidth,
                rowHeight,
                "FD",
            );
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        const lines: string[] = pdf.splitTextToSize(
            row.label,
            LABEL_WIDTH - 12,
        );
        const lineHeight = 9.5;
        const firstLineY =
            y + rowHeight / 2 - ((lines.length - 1) * lineHeight) / 2;

        lines.slice(0, 3).forEach((line, lineIndex) => {
            pdf.text(
                line,
                MARGIN + LABEL_WIDTH / 2,
                firstLineY + lineIndex * lineHeight,
                { align: "center", baseline: "middle" },
            );
        });
    }

    pdf.save(`Schedule ${formatDate(monday)}.pdf`);
}
