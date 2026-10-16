import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { MONTHS, ordinal } from "./invoiceDocx.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Your real SWMS, as a Word document. Only the few fields that change per job
// are swapped (principal contractor, date, workplace, person responsible and
// the workers list); everything else stays exactly as it is in the file.
const TEMPLATE_PATH = path.join(__dirname, "templates", "swms-template.docx");

// What the template says before anything is swapped in. The workers listed
// here are also the starting list on the SWMS form.
export const TEMPLATE_DEFAULTS = {
    principalContractor: "Ruby Homes",
    person: "Sudeep Joshi",
    workers: [
        "ANDREW DAHER",
        "CHARBEL YOUNANE",
        "GIO ABI NAHED",
        "Charbel Hanna",
        "Joe Habib",
        "Gabriel Hanna",
        "Ahmed Ldaayen",
        "Christopher Abi Nahed",
        "Fahad Sawadi",
        "Rahul Pawar",
        "Simbarashe Marowatasanga",
        "Anthony Khouzam",
    ],
};

const escapeXml = (text) =>
    String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

const T = (text) => `<w:t xml:space="preserve">${escapeXml(text)}</w:t>`;

function mustReplace(xml, pattern, replacement, what) {
    if (!pattern.test(xml)) {
        throw new Error(`SWMS template changed: couldn't find ${what}`);
    }

    return xml.replace(pattern, replacement);
}

// Rows of the workers table: the header row, then one row per worker, then
// two spare rows for hand-written names.
function workersTable(xml, workers) {
    const nameAt = xml.indexOf("ANDREW DAHER");
    const tableStart = xml.lastIndexOf("<w:tbl>", nameAt);
    const tableEnd = xml.indexOf("</w:tbl>", nameAt) + "</w:tbl>".length;
    const table = xml.slice(tableStart, tableEnd);
    const rows = table.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g);

    // header, 12 names, 2 spare rows
    const [head, ...rest] = rows;
    const nameRows = rest.slice(0, -2);
    const spare = rest.slice(-2);

    // The name sits in the first cell; keep its first run, drop the rest.
    const withName = (row, name) =>
        row.replace(/<w:tc>[\s\S]*?<\/w:tc>/, (cell) => {
            let seen = false;

            return cell.replace(/<w:r>(?:(?!<\/w:r>)[\s\S])*?<w:t[ >][\s\S]*?<\/w:r>/g, (run) => {
                if (seen) {
                    return "";
                }

                seen = true;

                return run.replace(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/, T(name));
            });
        });

    const last = nameRows[nameRows.length - 1];
    const built = workers.map((name, index) =>
        withName(nameRows[index] ?? last, name),
    );

    const out = [head, ...built, ...spare];
    const rebuilt =
        table.slice(0, table.indexOf(rows[0])) + out.join("") + "</w:tbl>";

    return xml.slice(0, tableStart) + rebuilt + xml.slice(tableEnd);
}

// data: { principalContractor, date: Date | null, location, person, workers[] }
// A null date and empty strings leave a field empty (the blank PDF form).
export function buildSwmsDocx(data) {
    const files = unzipSync(new Uint8Array(readFileSync(TEMPLATE_PATH)));
    let xml = strFromU8(files["word/document.xml"]);

    xml = mustReplace(
        xml,
        /<w:t xml:space="preserve"> Ruby Homes<\/w:t>/,
        T(` ${data.principalContractor ?? ""}`),
        "the principal contractor",
    );

    // "9" "th" (raised) " October " "202" "6": five runs in one paragraph.
    xml = mustReplace(
        xml,
        /<w:t>9<\/w:t>([\s\S]*?)<w:t>th<\/w:t>([\s\S]*?)<w:t xml:space="preserve"> October <\/w:t>([\s\S]*?)<w:t>202<\/w:t>([\s\S]*?)<w:t>6<\/w:t>/,
        (_, a, b, c, d) => {
            const date = data.date;

            return `${T(date ? String(date.getDate()) : "")}${a}${T(date ? ordinal(date.getDate()) : "")}${b}${T(date ? ` ${MONTHS[date.getMonth()]} ` : "")}${c}${T(date ? String(date.getFullYear()).slice(0, 3) : "")}${d}${T(date ? String(date.getFullYear()).slice(3) : "")}`;
        },
        "the date",
    );

    xml = mustReplace(
        xml,
        /<w:t xml:space="preserve">Lot 27, 7 <\/w:t>[\s\S]*?<w:t xml:space="preserve"> NSW 2573<\/w:t>/,
        T(data.location ?? ""),
        "the workplace location",
    );

    xml = mustReplace(
        xml,
        /<w:t>Sudeep Joshi<\/w:t>/g,
        T(data.person ?? ""),
        "the person responsible",
    );

    xml = workersTable(xml, data.workers ?? []);

    files["word/document.xml"] = strToU8(xml);

    return zipSync(files);
}
