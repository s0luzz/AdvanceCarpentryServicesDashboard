// One-time (or whenever you change invoice-template.docx):
//   node server/templates/make-pdf-template.mjs
//
// Makes invoice-template.pdf, the blank "form" the app stamps invoices onto.
// It needs Microsoft Word on a Mac, but only for this step: the app itself
// never opens Word. Everything that varies per invoice (including the
// "TAX INVOICE" heading, whose position depends on the client name's
// length) is left out so the app can draw it.
import { execFileSync } from "child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { buildInvoiceDocx } from "../invoiceDocx.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// Word is sandboxed: it can always read/write inside its own container.
const container = path.join(
    os.homedir(),
    "Library/Containers/com.microsoft.Word/Data/Documents",
);
mkdirSync(container, { recursive: true });

const blank = buildInvoiceDocx({
    clientName: "",
    address: "",
    invoiceNumber: "",
    date: null,
    description: "",
    amountExGst: null,
    gst: null,
    amountIncGst: null,
});

// Blank out the "TAX INVOICE" words too (the app draws them). They become
// spaces, not nothing, so the line keeps the height it has in Word.
const files = unzipSync(blank);
files["word/document.xml"] = strToU8(
    strFromU8(files["word/document.xml"]).replace(
        /<w:t(?: [^>]*)?>(?:TAX|INVOICE)<\/w:t>/g,
        '<w:t xml:space="preserve"> </w:t>',
    ),
);

const docx = path.join(container, "acs-template.docx");
const pdf = path.join(container, "acs-template.pdf");
const script = path.join(container, "acs-template.applescript");

writeFileSync(docx, zipSync(files));
rmSync(pdf, { force: true });
writeFileSync(
    script,
    `on run argv
    tell application "Microsoft Word"
        set theDoc to open file name (item 1 of argv)
        delay 1
        if theDoc is missing value then set theDoc to document 1
        save as theDoc file name (item 2 of argv) file format format PDF
        close document 1
    end tell
end run
`,
);

try {
    execFileSync("osascript", [script, docx, pdf], { timeout: 90_000 });
    copyFileSync(pdf, path.join(here, "invoice-template.pdf"));
    console.log("Wrote server/templates/invoice-template.pdf");
} finally {
    for (const file of [docx, pdf, script]) {
        rmSync(file, { force: true });
    }
}
