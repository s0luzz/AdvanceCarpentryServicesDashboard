import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { MONTHS, ordinal } from "./invoiceDocx.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The blank SWMS, drawn by Word once (see templates/make-swms-pdf-template.mjs):
// every table, tick-box and control measure. The app only adds the fields that
// change per job, so making a PDF needs nothing outside this project.
const FORM_PATH = path.join(__dirname, "templates", "swms-template.pdf");

// Where each field goes (PDF points from the bottom-left corner), measured
// from Word's own rendering of the template.
const PC = { x: 531.8, y: 428.2 };
const DATE = { x: 529.4, y: 396.2 };
const LOCATION = { x: 529.4, y: 349.2 };
const PERSON_PAGE_1 = { x: 327.2, y: 69.8, size: 11 };
const PERSON_PAGE_2 = { x: 336.3, y: 493.0 };

const BODY_SIZE = 9.1;
const SUPERSCRIPT_SIZE = 6;
const SUPERSCRIPT_RAISE = 3.2;
const INK = rgb(0, 0, 0);

// The workers table (last real page). The template has 14 rows; more are drawn
// in the same style, down to the bottom margin.
const WORKERS_PAGE = 5; // zero-based
const ROW_PITCH = 16.56;
const TEMPLATE_ROWS = 14;
const FIRST_ROW_Y = [435.4, 418.8, 402.2, 382.3];
const LAST_TEMPLATE_BASELINE = 217.2;
const LAST_TEMPLATE_LINE = 213.6;
const LINE_THICKNESS = 0.48;
const COLUMN_LINES = [72.48, 312.96, 553.68, 792.96];
export const MAX_WORKERS = 24;

let formBytes;

export async function buildSwmsPdf(data) {
    formBytes ??= readFileSync(FORM_PATH);

    const pdf = await PDFDocument.load(formBytes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pages = pdf.getPages();

    // The built-in fonts can't draw every character; swap those for "?".
    const supported = new Set(font.getCharacterSet());
    const clean = (text) =>
        [...String(text ?? "")]
            .map((char) => (supported.has(char.codePointAt(0)) ? char : "?"))
            .join("");

    const width = (text, size = BODY_SIZE) =>
        [...clean(text)].reduce(
            (total, char) => total + font.widthOfTextAtSize(char, size),
            0,
        );

    const draw = (page, text, x, y, size = BODY_SIZE) => {
        if (text) {
            page.drawText(clean(text), { x, y, size, font, color: INK });
        }
    };

    const first = pages[0];

    draw(first, data.principalContractor, PC.x, PC.y);

    // 15th October 2026, with the "th" raised and small like the Word file.
    const date = data.date;
    const day = String(date.getDate());
    const suffix = ordinal(date.getDate());
    const suffixX = DATE.x + width(day);

    draw(first, day, DATE.x, DATE.y);
    draw(first, suffix, suffixX, DATE.y + SUPERSCRIPT_RAISE, SUPERSCRIPT_SIZE);
    draw(
        first,
        ` ${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
        suffixX + width(suffix, SUPERSCRIPT_SIZE),
        DATE.y,
    );

    draw(first, data.location, LOCATION.x, LOCATION.y);
    draw(first, data.person, PERSON_PAGE_1.x, PERSON_PAGE_1.y, PERSON_PAGE_1.size);
    draw(pages[1], data.person, PERSON_PAGE_2.x, PERSON_PAGE_2.y);

    // Workers: row baselines follow the template's own rows (the first three
    // are slightly larger and further left), then extra rows in the same grid.
    const sheet = pages[WORKERS_PAGE];
    const workers = (data.workers ?? []).slice(0, MAX_WORKERS);

    workers.forEach((name, index) => {
        const y =
            index < FIRST_ROW_Y.length
                ? FIRST_ROW_Y[index]
                : LAST_TEMPLATE_BASELINE + ROW_PITCH * (TEMPLATE_ROWS - 1 - index);

        if (index >= TEMPLATE_ROWS) {
            // A new ruled row below the template's last one.
            const extra = index - TEMPLATE_ROWS + 1;
            const bottom = LAST_TEMPLATE_LINE - ROW_PITCH * extra;

            for (const x of COLUMN_LINES) {
                sheet.drawRectangle({
                    x,
                    y: bottom,
                    width: LINE_THICKNESS,
                    height: ROW_PITCH,
                    color: INK,
                    borderWidth: 0,
                });
            }

            sheet.drawRectangle({
                x: COLUMN_LINES[0],
                y: bottom,
                width: COLUMN_LINES[3] - COLUMN_LINES[0] + LINE_THICKNESS,
                height: LINE_THICKNESS,
                color: INK,
                borderWidth: 0,
            });
        }

        const large = index < 3;

        draw(sheet, name, large ? 73 : 78.2, y, large ? 10.1 : 9.6);
    });

    return pdf.save();
}
