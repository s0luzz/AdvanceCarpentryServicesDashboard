// One-time (or whenever you change swms-template.docx):
//   node server/templates/make-swms-pdf-template.mjs
//
// Makes swms-template.pdf, the blank SWMS the app stamps its fields onto.
// It needs Microsoft Word on a Mac, but only for this step: the app itself
// never opens Word. With the fields left empty, Word draws everything else
// (logo, tables, controls, spare signature rows).
import { execFileSync } from "child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import { buildSwmsDocx } from "../swmsDocx.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// Word is sandboxed: it can always read/write inside its own container.
const container = path.join(
    os.homedir(),
    "Library/Containers/com.microsoft.Word/Data/Documents",
);
mkdirSync(container, { recursive: true });

export function wordToPdf(docxBytes, outPath) {
    // A fresh name each time, so Word never reuses a document it has cached.
    const stamp = `${process.pid}-${Date.now()}`;
    const docx = path.join(container, `acs-swms-${stamp}.docx`);
    const pdf = path.join(container, `acs-swms-${stamp}.pdf`);
    const script = path.join(container, `acs-swms-${stamp}.applescript`);

    writeFileSync(docx, docxBytes);
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
        copyFileSync(pdf, outPath);
    } finally {
        for (const file of [docx, pdf, script]) {
            rmSync(file, { force: true });
        }
    }
}

// The template's own rows: 12 names plus 2 spare, all left empty here.
export const BLANK = {
    principalContractor: "",
    date: null,
    location: "",
    person: "",
    workers: Array.from({ length: 12 }, () => ""),
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    wordToPdf(buildSwmsDocx(BLANK), path.join(here, "swms-template.pdf"));
    console.log("Wrote server/templates/swms-template.pdf");
}
