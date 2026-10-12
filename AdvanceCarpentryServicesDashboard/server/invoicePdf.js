import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { MONTHS, money, ordinal } from "./invoiceDocx.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The blank invoice, drawn by Word once (see templates/make-pdf-template.mjs):
// logo, labels, rules and bank details. The app only adds the changing text,
// so making a PDF needs nothing outside this project.
const FORM_PATH = path.join(__dirname, "templates", "invoice-template.pdf");

// Where each field goes (PDF points from the bottom-left corner), measured
// from Word's own rendering of the template. Each shares a baseline with its
// label on the blank form ("To:", "Site Address:", the "-" bullet, "TOTAL"...).
const NAME = { x: 90.28, y: 647.76 };
const ADDRESS = { x: 133.97, y: 621.12 };
const NUMBER = { x: 432, y: 538.8 };
const DATE = { x: 432, y: 517.2 };
const DESCRIPTION = { x: 113.28, y: 430.8, maxWidth: 305, lineHeight: 13 };
const EX_GST = { x: 429.84, y: 432 };
const GST = { x: 490.08, y: 432 };
const TOTAL = { x: 490.08, y: 243.6 };

const BODY_SIZE = 11.04;
const HEADING_SIZE = 12;
const SUPERSCRIPT_SIZE = 6.96;
const SUPERSCRIPT_RAISE = 4.56;

// "TAX INVOICE" sits after six tab characters, and Word's tab stops are every
// half inch from the left margin, so its position follows the client name.
const LEFT_MARGIN = 72;
const TAB_STOP = 36;
const TABS_BEFORE_HEADING = 6;
const RIGHT_EDGE = 595.2 - 72;

const INK = rgb(0.05, 0.05, 0.05);
const RED = rgb(1, 0, 0);

const nextTabStop = (x) =>
    LEFT_MARGIN +
    TAB_STOP * (Math.floor((x - LEFT_MARGIN) / TAB_STOP) + 1);

let formBytes;

export async function buildInvoicePdf(data) {
    formBytes ??= readFileSync(FORM_PATH);

    const pdf = await PDFDocument.load(formBytes);
    const page = pdf.getPage(0);
    const regular = await pdf.embedFont(StandardFonts.TimesRoman);
    const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

    // The built-in fonts can't draw every character; swap those for "?".
    const supported = new Set(regular.getCharacterSet());
    const clean = (text) =>
        [...String(text ?? "")]
            .map((char) =>
                supported.has(char.codePointAt(0)) ? char : "?",
            )
            .join("");

    const draw = (text, x, y, { font = regular, size = BODY_SIZE, color = INK } = {}) => {
        if (text) {
            page.drawText(clean(text), { x, y, size, font, color });
        }
    };

    // Measured glyph by glyph: the library's own measurement applies kerning,
    // which Word (and so the template's tab layout) doesn't.
    const width = (text, font = regular, size = BODY_SIZE) =>
        [...clean(text)].reduce(
            (total, char) => total + font.widthOfTextAtSize(char, size),
            0,
        );

    // To:  <client>            TAX INVOICE
    draw(data.clientName, NAME.x, NAME.y);

    let headingX = width(data.clientName) + NAME.x;
    for (let i = 0; i < TABS_BEFORE_HEADING; i += 1) {
        headingX = nextTabStop(headingX);
    }
    headingX = Math.min(
        headingX,
        RIGHT_EDGE - width("TAX INVOICE", regular, HEADING_SIZE),
    );
    draw("TAX", headingX, NAME.y, { size: HEADING_SIZE });
    draw(
        "INVOICE",
        headingX + width("TAX ", regular, HEADING_SIZE),
        NAME.y,
        { size: HEADING_SIZE },
    );

    draw(data.address, ADDRESS.x, ADDRESS.y);
    draw(String(data.invoiceNumber), NUMBER.x, NUMBER.y);

    // 2nd October 2026, with the "nd" raised and small like the Word file.
    const day = String(data.date.getDate());
    const rest = ` ${MONTHS[data.date.getMonth()]} ${data.date.getFullYear()}`;
    const ordinalText = ordinal(data.date.getDate());
    const ordinalX = DATE.x + width(day);

    draw(day, DATE.x, DATE.y);
    draw(ordinalText, ordinalX, DATE.y + SUPERSCRIPT_RAISE, {
        size: SUPERSCRIPT_SIZE,
    });
    draw(
        rest,
        ordinalX + width(ordinalText, regular, SUPERSCRIPT_SIZE),
        DATE.y,
    );

    // Description wraps inside its column; the amounts stay on the first line.
    let line = "";
    let y = DESCRIPTION.y;

    for (const word of clean(data.description).split(/\s+/).filter(Boolean)) {
        const attempt = line ? `${line} ${word}` : word;

        if (line && width(attempt) > DESCRIPTION.maxWidth) {
            draw(line, DESCRIPTION.x, y);
            y -= DESCRIPTION.lineHeight;
            line = word;
        } else {
            line = attempt;
        }
    }

    draw(line, DESCRIPTION.x, y);

    draw(money(data.amountExGst), EX_GST.x, EX_GST.y);
    draw(money(data.gst), GST.x, GST.y);
    draw(money(data.amountIncGst), TOTAL.x, TOTAL.y, {
        font: bold,
        color: RED,
    });

    return pdf.save();
}
