// Builds the "Description & Inclusions" list of a quote from a few choices,
// and reads the choices back out of an existing quote's lines.

export type QuoteType = "single" | "double" | "duplex";

export type QuoteOptions = {
    type: QuoteType;
    steel: boolean; // false => steel and crane become "NOT including"
    studs: "90x35" | "90x45";
    hebel: boolean; // supply and install a hebel party wall
    hebelSize: 50 | 75;
    granny: boolean;
    studio: boolean;
    garage: boolean;
    extra: string[]; // custom lines, written by hand
    removed: string[]; // keys of standard lines switched off
};

export type ScopeLine = { key: string; text: string };

export const TYPE_LABELS: Record<QuoteType, string> = {
    single: "Single storey",
    double: "Two storey",
    duplex: "Duplex",
};

export function defaultOptions(type: QuoteType = "double"): QuoteOptions {
    return {
        type,
        steel: type !== "single",
        studs: "90x35",
        hebel: false,
        hebelSize: 50,
        granny: false,
        studio: false,
        garage: false,
        extra: [],
        removed: [],
    };
}

// Every standard line, in the order it appears on the quote.
export function standardLines(options: QuoteOptions): ScopeLine[] {
    const { type, steel } = options;
    const lines: ScopeLine[] = [];
    const add = (key: string, text: string) => lines.push({ key, text });
    const twoStorey = type !== "single";

    const outbuildings = [
        options.granny && "Granny Flat Framing.",
        options.studio && "Studio Framing.",
        options.garage && "Detached Garage Framing.",
    ].filter(Boolean) as string[];

    if (outbuildings.length > 0) {
        // These replace the "X Storey Dwelling" line.
        outbuildings.forEach((text) => add(text, text));
    } else {
        add(
            "type",
            type === "single"
                ? "Single Storey Dwelling."
                : type === "double"
                  ? "Two Storey Dwelling."
                  : "Two Storey Duplex.",
        );
    }

    // One generic framing size line, for every building type.
    add("studs", `90 X ${options.studs === "90x35" ? "35" : "45"} H2.`);

    if (twoStorey) {
        add(
            "gf-walls",
            "Supply And Install Ground Floor Walls 450mm Spacing With Double Top Plate.",
        );
        add("ff-walls", "Supply And Install First Floor Walls 550mm Spacing.");
        add("floor", "Supply And Install Floor 300x63 LVL I Joist As Per Structural.");
        add("tongue", "Supply And Install Yellow Tongue Glued Down And Nailed.");
        add("scyon", "Supply And Install Compressed Fibro (Scyon) In All Wet Areas.");
        add("ceiling", "Supply And Install Ceiling And Roof And Lower Roofs.");
    } else {
        add("gf-walls", "Supply And Install Ground Floor Walls 550mm Spacing.");
        add("ceiling", "Supply And Install Ceiling And Roof.");
    }

    if (type === "duplex") {
        add(
            "party-frame",
            "Supply And Install Timber Framed Walls Either Side Of Party Wall.",
        );
    }

    if (options.hebel) {
        add("hebel", `Supply And Install ${options.hebelSize}mm Hebel Party Wall.`);
    } else if (type === "duplex") {
        add("hebel", "NOT Including Hebel Party Wall.");
    }

    add("bracing", "Adequate Bracing To Walls And Roof Structure.");
    add("wardrobe", "Wardrobe Headers Frame Outs Same Height As Door Heights.");
    add("niche", "Bathroom Niche Frame Outs.");

    if (twoStorey) {
        add("windows", "Temporary Install Windows For External Structure.");
    }

    add("brick-gauge", "Positioning Of Windows To Be In Accordance With Brick Gauge.");
    add("eaves", "Supply And Install Eaves Around Perimeter Of Dwelling.");

    add(
        "steel",
        steel
            ? "Supply And Install Structural Steel As Per Structural Plans."
            : "NOT Including Supply And Install Of Structural Steel.",
    );
    add("crane", steel ? "Supply Of Crane." : "NOT Including Supply Of Crane.");

    // Custom lines go here (see buildScope).
    add("false-ceiling", "NOT Including Any False Ceiling Feature.");
    add("alfresco", "NOT Including Any Alfresco/Balcony Ceiling Sheeting.");
    add("battens", "NOT Including Roof Battens.");

    if (!twoStorey) {
        add("windows", "NOT Including Installation Of Windows For External Structure.");
        add("pergolas", "NOT Including Any Pergolas.");
    }

    add("as-per-plan", "All Works To Follow As Per Plan.");
    add("as1684", "All Works To Comply With Timber Framing Code AS1684.");

    return lines;
}

// The lines that end up on the quote (standard minus removed, plus custom).
export function buildScope(options: QuoteOptions): string[] {
    const kept = standardLines(options).filter(
        (line) => !options.removed.includes(line.key),
    );
    const custom = options.extra.map((line) => line.trim()).filter(Boolean);
    const at = kept.findIndex((line) => line.key === "false-ceiling");

    if (at === -1) {
        return [...kept.map((line) => line.text), ...custom];
    }

    return [
        ...kept.slice(0, at).map((line) => line.text),
        ...custom,
        ...kept.slice(at).map((line) => line.text),
    ];
}

// ---------------------------------------------------------------- reading back

const norm = (text: string) =>
    text.toLowerCase().replace(/[.\s]+/g, " ").trim();

// Lines that the builder produces. Anything else is treated as a custom line.
const STANDARD: RegExp[] = [
    /^(single|two|double) storey (dwelling|duplex)$/,
    /^(granny flat|studio|detached garage|garage) framing$/,
    /^90 ?x ?(35|45)( for (studs|top plate and bottom plates)| ?h2)?$/,
    /^supply and install (ground|first) floor walls/,
    /^supply and install floor 300x63/,
    /^supply and install yellow tongue/,
    /^supply and install compressed fibro/,
    /^supply and install ceiling and roof( and lower roofs)?$/,
    /^supply and install timber framed walls either side/,
    /^(supply and install \d+ ?mm hebel party wall|not including hebel party wall)$/,
    /^adequate bracing/,
    /^wardrobe headers/,
    /^bathroom niche/,
    /^temporary install windows/,
    /^positioning of windows/,
    /^supply and install eaves around/,
    /steel|crane/, // regenerated from the steel switch
    /^not including (any false ceiling feature|any alfresco\/balcony ceiling sheeting|roof battens)$/,
    /^not including (installation of windows for external structure|any pergolas?)$/,
    /^all works to (follow as per plan|comply with timber framing code as1684)$/,
];

// Works out the choices behind an existing quote's lines. Lines the builder
// wouldn't have written are kept as custom lines.
export function optionsFromScope(lines: string[]): QuoteOptions {
    const all = lines.map(norm);
    const has = (pattern: RegExp) => all.some((line) => pattern.test(line));

    const type: QuoteType = has(/duplex|party wall|hebel|hebal/)
        ? "duplex"
        : has(/two storey|first floor|double storey/)
          ? "double"
          : "single";

    const options = defaultOptions(type);

    const steelLines = all.filter((line) => /steel|crane/.test(line));

    options.steel =
        steelLines.length === 0
            ? type !== "single"
            : steelLines.some((line) => !line.startsWith("not "));
    options.studs = has(/^90 ?x ?35/) ? "90x35" : has(/^90 ?x ?45/) ? "90x45" : "90x35";
    options.hebel = has(/^supply and install \d+ ?mm (hebel|hebal) party wall/);
    options.hebelSize = has(/75 ?mm (hebel|hebal)/) ? 75 : 50;
    options.granny = has(/granny flat framing/);
    options.studio = has(/studio framing/);
    options.garage = has(/garage framing/);
    options.extra = lines
        .map((line) => line.trim())
        .filter((line) => line && !STANDARD.some((pattern) => pattern.test(norm(line))));

    return options;
}
