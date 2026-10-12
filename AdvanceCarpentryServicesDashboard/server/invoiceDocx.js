import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Your real invoice, as a Word document. Only the changing text is swapped;
// every font, border and layout choice stays exactly as it is in the file.
const TEMPLATE_PATH = path.join(
    __dirname,
    "templates",
    "invoice-template.docx",
);

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

function ordinal(day) {
    if (day >= 11 && day <= 13) {
        return "th";
    }

    return { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th";
}

function money(value) {
    return `$${value.toLocaleString("en-AU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

const unescapeXml = (text) =>
    text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");

const escapeXml = (text) =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

const T_ELEMENT = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;
const isBlank = (text) => text.trim() === "";

// Set the first non-blank text piece in [from, to) to `value`, blank the
// other non-blank pieces there (Word splits one phrase across many pieces).
function fill(texts, from, to, value) {
    let placed = false;

    for (let i = from; i < to; i += 1) {
        if (isBlank(texts[i])) {
            continue;
        }

        texts[i] = placed ? "" : value;
        placed = true;
    }
}

// Returns the new text pieces for a paragraph, or null to leave it alone.
function rewriteParagraph(texts, data, state) {
    const next = [...texts];
    const full = texts.join("");
    const labelAt = (label) =>
        texts.findIndex((text) => text.trim() === label);

    if (/^To:/.test(full.trim()) && full.includes("TAX")) {
        const start = labelAt("To:");
        const end = texts.findIndex(
            (text, i) => i > start && text.trim().startsWith("TAX"),
        );

        if (start === -1 || end === -1) return null;

        fill(next, start + 1, end, data.clientName);
        return next;
    }

    if (/^Site Address:/.test(full.trim())) {
        const start = labelAt("Site Address:");

        if (start === -1) return null;

        fill(next, start + 1, texts.length, data.address);
        return next;
    }

    if (/^Invoice Number/.test(full.trim())) {
        const start = texts.findIndex((text) =>
            text.trim().startsWith("Invoice Number"),
        );

        fill(next, start + 1, texts.length, String(data.invoiceNumber));
        return next;
    }

    if (/^Date of Invoice/.test(full.trim())) {
        const start = texts.findIndex((text) =>
            text.trim().startsWith("Date of Invoice"),
        );
        const month = texts.findIndex(
            (text, i) =>
                i > start && MONTHS.includes(text.trim()),
        );

        if (month === -1) return null;

        // [day][ordinal, in superscript pieces]  [month]  [year pieces]
        const dayPieces = [];

        for (let i = start + 1; i < month; i += 1) {
            if (!isBlank(texts[i])) dayPieces.push(i);
        }

        const [dayAt, ordinalAt, ...restOrdinal] = dayPieces;

        if (dayAt !== undefined) next[dayAt] = String(data.date.getDate());
        if (ordinalAt !== undefined) {
            next[ordinalAt] = ordinal(data.date.getDate());
        }
        restOrdinal.forEach((i) => (next[i] = ""));

        next[month] = `${MONTHS[data.date.getMonth()]} `;
        fill(next, month + 1, texts.length, String(data.date.getFullYear()));
        return next;
    }

    if (/\d+%\s*of\s*total/i.test(full)) {
        fill(next, 0, texts.length, data.description);
        return next;
    }

    if (/^\$[\d,]+(\.\d+)?$/.test(full.trim())) {
        // The three amounts appear in order: ex GST, GST, total incl. GST.
        const value = [data.amountExGst, data.gst, data.amountIncGst][
            state.amountIndex
        ];
        state.amountIndex += 1;

        if (value === undefined) return null;

        fill(next, 0, texts.length, money(value));
        return next;
    }

    return null;
}

export function buildInvoiceDocx(data) {
    const files = unzipSync(new Uint8Array(readFileSync(TEMPLATE_PATH)));
    const xml = strFromU8(files["word/document.xml"]);
    const state = { amountIndex: 0 };

    const filled = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragraph) => {
        const texts = [...paragraph.matchAll(T_ELEMENT)].map(
            (match) => unescapeXml(match[1]),
        );

        if (texts.length === 0) {
            return paragraph;
        }

        const rewritten = rewriteParagraph(texts, data, state);

        if (!rewritten) {
            return paragraph;
        }

        let index = 0;

        return paragraph.replace(
            T_ELEMENT,
            () =>
                `<w:t xml:space="preserve">${escapeXml(rewritten[index++])}</w:t>`,
        );
    });

    if (state.amountIndex < 3) {
        throw new Error(
            "The invoice template didn't have the three amount fields we expected.",
        );
    }

    files["word/document.xml"] = strToU8(filled);

    return zipSync(files);
}
