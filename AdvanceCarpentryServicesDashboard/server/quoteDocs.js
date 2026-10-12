import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { strToU8, zipSync } from "fflate";

import { MONTHS, money, ordinal } from "./invoiceDocx.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO = readFileSync(path.join(__dirname, "templates", "quote-logo.png"));

// data: { to, site, date: Date, number, scope: string[], exGst, gst, inclGst, cash }
// Both builders draw the same page, measured from your own quote documents
// (A4, Times 11pt, 72pt left margin), so the Word file and the PDF match.

const escapeXml = (text) =>
    String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

const dateParts = (date) => ({
    day: String(date.getDate()),
    suffix: ordinal(date.getDate()),
    rest: ` ${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
});

// ---------------------------------------------------------------- Word (.docx)

const run = (text, { bold, color, sup } = {}) =>
    `<w:r><w:rPr>${bold ? "<w:b/>" : ""}${color ? `<w:color w:val="${color}"/>` : ""}${sup ? '<w:vertAlign w:val="superscript"/>' : ""}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;

const tab = "<w:r><w:tab/></w:r>";

const para = (content, { before = 0, after = 0, ind = "", tabs = [], keep = false } = {}) =>
    `<w:p><w:pPr>${keep ? "<w:keepNext/>" : ""}${
        tabs.length
            ? `<w:tabs>${tabs.map((t) => `<w:tab w:val="left" w:pos="${t}"/>`).join("")}</w:tabs>`
            : ""
    }<w:spacing w:before="${before}" w:after="${after}"/>${ind}</w:pPr>${content}</w:p>`;

const cell = (width, content, right = 0) =>
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcMar><w:left w:w="0" w:type="dxa"/><w:right w:w="${right}" w:type="dxa"/></w:tcMar></w:tcPr>${content}</w:tc>`;

const COLS = [6600, 1528, 1232]; // description | total | GST (twips, 468pt in all)

function documentXml(data) {
    const { day, suffix, rest } = dateParts(data.date);
    const red = "FF0000";
    const cols = COLS;

    const bullets = data.scope
        .map((line) =>
            para(`${run("-")}${tab}${run(line)}`, {
                ind: '<w:ind w:left="836" w:hanging="360"/>',
                tabs: [836],
            }),
        )
        .join("");

    const amountCell = (value) =>
        para(run(value), { ind: '<w:ind w:left="0"/>' });

    const headRow = `<w:tr>${cell(cols[0], para(run("Description & Inclusions", { bold: true }), { after: 320, keep: true, ind: '<w:ind w:left="118"/>' }))}${cell(
        cols[1],
        para(run("Total", { bold: true }), { after: 320, keep: true }),
    )}${cell(cols[2], para(data.cash ? "" : run("GST", { bold: true }), { after: 320, keep: true }))}</w:tr>`;

    const bodyRow = `<w:tr>${cell(cols[0], bullets, 300)}${cell(cols[1], amountCell(money(data.cash ? data.inclGst : data.exGst)))}${
        cell(cols[2], data.cash ? para("") : amountCell(money(data.gst)))
    }</w:tr>`;

    const totalRow = `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(cols[0], para("", { before: 240 }))}${cell(
        cols[1],
        para(run(data.cash ? "TOTAL CASH" : "TOTAL INC GST", { bold: true, color: red }), { before: 240 }),
    )}${cell(cols[2], para(run(money(data.inclGst), { bold: true, color: red }), { before: 240 }))}</w:tr>`;

    const logoW = 4897120;
    const logoH = 857250;

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>
${para(
    `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>274320</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>169000</wp:posOffset></wp:positionV><wp:extent cx="${logoW}" cy="${logoH}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="1" name="Logo" descr="Advance Carpentry Services"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${logoW}" cy="${logoH}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>${tab}${run("ACN. 12 166 309 851")}`,
    { tabs: [7112] },
)}
${para(`${run("P: 0406 641 049")}${tab}${run("QUOTE", { bold: true })}`, { before: 1220, tabs: [7200] })}
${para(run("E: Info@advancecarpentryservices.com.au"))}
${para(run("License Number: 270963C"))}
${para(run(`To: ${data.to}`), { before: 610 })}
${para(run(`Site Address: ${data.site}`), { before: 180 })}
${para(`${tab}${run("Date")}${tab}${run(day)}${run(suffix, { sup: true })}${run(rest)}`, { before: 180, tabs: [5040, 7200] })}
${para(`${tab}${run("Quote Number")}${tab}${run(String(data.number))}`, { before: 180, tabs: [5040, 7200] })}
${para("", { before: 400 })}
<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cols.map((c) => `<w:gridCol w:w="${c}"/>`).join("")}</w:tblGrid>${headRow}${bodyRow}${totalRow}</w:tbl>
${para("")}
<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="1100" w:bottom="2000" w:left="1440" w:header="720" w:footer="1650" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const FOOTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${para(
    `${run("M: 0406 641 049")}${tab}${run("29 Meakin Street, MERRYLANDS NSW 2160")}`,
    { tabs: [4780] },
)}</w:ftr>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-AU"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;

export function buildQuoteDocx(data) {
    return zipSync({
        "[Content_Types].xml": strToU8(CONTENT_TYPES),
        "_rels/.rels": strToU8(ROOT_RELS),
        "word/document.xml": strToU8(documentXml(data)),
        "word/_rels/document.xml.rels": strToU8(DOC_RELS),
        "word/styles.xml": strToU8(STYLES_XML),
        "word/footer1.xml": strToU8(FOOTER_XML),
        "word/media/logo.png": new Uint8Array(LOGO),
    });
}

// ------------------------------------------------------------------------ PDF

const SIZE = 11;
const LINE = 12.65;
const INK = rgb(0, 0, 0);
const RED = rgb(1, 0, 0);
const BULLET_X = 95.8;
const TEXT_X = 113.8;
const WRAP_WIDTH = 273;
const TOTAL_X = 402.4;
const GST_X = 478.8;

export async function buildQuotePdf(data) {
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.TimesRoman);
    const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const logo = await pdf.embedPng(LOGO);

    // The built-in fonts can't draw every character; swap those for "?".
    const supported = new Set(regular.getCharacterSet());
    const clean = (text) =>
        [...String(text ?? "")]
            .map((char) => (supported.has(char.codePointAt(0)) ? char : "?"))
            .join("");

    // Glyph by glyph: the library's own measurement applies kerning, Word doesn't.
    const width = (text, font = regular, size = SIZE) =>
        [...clean(text)].reduce((sum, char) => sum + font.widthOfTextAtSize(char, size), 0);

    let page;
    const draw = (text, x, y, { font = regular, size = SIZE, color = INK } = {}) => {
        if (text) {
            page.drawText(clean(text), { x, y, size, font, color });
        }
    };

    const footer = () => {
        draw("M: 0406 641 049", 72.1, 93.1);
        draw("29 Meakin Street, MERRYLANDS NSW 2160", 310.5, 93.1);
    };

    const newPage = () => {
        page = pdf.addPage([595.44, 841.92]);
        footer();
    };

    newPage();
    page.drawImage(logo, { x: 21.6, y: 761.1, width: 385.6, height: 67.5 });
    draw("ACN. 12 166 309 851", 427.6, 797.3);
    draw("P: 0406 641 049", 72.1, 722.6);
    draw("QUOTE", 432.1, 722.6, { font: bold });
    draw("E: Info@advancecarpentryservices.com.au", 72.1, 709);
    draw("License Number: 270963C", 72.1, 695.5);
    draw(`To: ${data.to}`, 72.1, 652.3);
    draw(`Site Address: ${data.site}`, 72.1, 630.7);

    const { day, suffix, rest } = dateParts(data.date);
    const suffixX = 432.1 + width(day);
    draw("Date", 324.1, 608.9);
    draw(day, 432.1, 608.9);
    draw(suffix, suffixX, 613.4, { size: 7 });
    draw(rest, suffixX + width(suffix, regular, 7), 608.9);
    draw("Quote Number", 324.1, 587.3);
    draw(String(data.number), 432.1, 587.3);

    draw("Description & Inclusions", 77.9, 546.5, { font: bold });
    draw("Total", TOTAL_X, 546.5, { font: bold });

    if (!data.cash) {
        draw("GST", GST_X, 546.5, { font: bold });
    }

    let y = 517.9;
    draw(money(data.cash ? data.inclGst : data.exGst), TOTAL_X, y + 1);

    if (!data.cash) {
        draw(money(data.gst), GST_X, y + 1);
    }

    for (const line of data.scope) {
        const words = clean(line).split(/\s+/).filter(Boolean);
        const rows = [];
        let current = "";

        for (const word of words) {
            const attempt = current ? `${current} ${word}` : word;

            if (current && width(attempt) > WRAP_WIDTH) {
                rows.push(current);
                current = word;
            } else {
                current = attempt;
            }
        }

        rows.push(current);

        // Keep a line's wrapped rows together; run on to a fresh page when full.
        if (y - LINE * (rows.length - 1) < 130) {
            newPage();
            y = 780;
        }

        draw("-", BULLET_X, y);
        rows.forEach((row, index) => draw(row, TEXT_X, y - index * LINE));
        y -= LINE * rows.length;
    }

    let totalY = y - 11.5;

    if (totalY < 112) {
        newPage();
        totalY = 780;
    }

    const red = { font: bold, color: RED };

    if (data.cash) {
        draw("TOTAL CASH", TOTAL_X, totalY, red);
    } else {
        draw("TOTAL INC", TOTAL_X, totalY, red);
        draw("GST", TOTAL_X, totalY - LINE, red);
        draw(money(data.inclGst), 471.4, totalY, red);
    }

    if (data.cash) {
        draw(money(data.inclGst), 484, totalY, red);
    }

    return pdf.save();
}
