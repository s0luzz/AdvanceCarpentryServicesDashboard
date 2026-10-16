import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { promises as fs } from "fs";
import { existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";

import { buildInvoiceDocx } from "./invoiceDocx.js";
import { buildInvoicePdf } from "./invoicePdf.js";
import { buildQuoteDocx, buildQuotePdf } from "./quoteDocs.js";
import { TEMPLATE_DEFAULTS, buildSwmsDocx } from "./swmsDocx.js";
import { MAX_WORKERS, buildSwmsPdf } from "./swmsPdf.js";
import {
    COOKIE_NAME,
    clientIp,
    hasPassword,
    isValidSession,
    lockoutRemainingMs,
    login,
    logout,
    parseCookies,
    sessionCookie,
} from "./auth.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(
    __dirname,
    "..",
    "db.json",
);

const uploadsPath = path.join(
    __dirname,
    "..",
    "uploads",
);

if (!existsSync(uploadsPath)) {
    mkdirSync(uploadsPath, {
        recursive: true,
    });
}

app.use(cors());
app.use(express.json());

/**
 * Auth: everything under /api and /uploads needs a signed-in session,
 * except the auth endpoints themselves.
 */
app.post("/api/auth/login", async (req, res) => {
    try {
        const ip = clientIp(req);
        const lockedMs = lockoutRemainingMs(ip);

        if (lockedMs > 0) {
            return res.status(429).json({
                message: `Too many attempts. Try again in ${Math.ceil(lockedMs / 60000)} minute(s).`,
            });
        }

        if (!(await hasPassword())) {
            return res.status(503).json({
                message:
                    "No password has been set yet. On the computer running the server, run: npm run set-password",
            });
        }

        const token = await login(req.body?.password, ip);

        if (!token) {
            return res
                .status(401)
                .json({ message: "Incorrect password." });
        }

        res.setHeader("Set-Cookie", sessionCookie(token, req));
        return res.json({ authenticated: true });
    } catch (error) {
        console.error("Login failed:", error);
        return res.status(500).json({ message: "Login failed" });
    }
});

app.post("/api/auth/logout", async (req, res) => {
    try {
        await logout(parseCookies(req.headers.cookie)[COOKIE_NAME]);
        res.setHeader("Set-Cookie", sessionCookie("", req, 0));
        return res.json({ authenticated: false });
    } catch (error) {
        console.error("Logout failed:", error);
        return res.status(500).json({ message: "Logout failed" });
    }
});

app.get("/api/auth/me", async (req, res) => {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];

    if (!(await isValidSession(token))) {
        return res.status(401).json({
            authenticated: false,
            passwordSet: await hasPassword(),
        });
    }

    return res.json({ authenticated: true });
});

app.use(async (req, res, next) => {
    try {
        const token = parseCookies(req.headers.cookie)[COOKIE_NAME];

        if (await isValidSession(token)) {
            return next();
        }

        return res
            .status(401)
            .json({ message: "Please sign in." });
    } catch (error) {
        return next(error);
    }
});

app.use(
    "/uploads",
    express.static(uploadsPath),
);

const storage = multer.diskStorage({
    destination: (
        _req,
        _file,
        callback,
    ) => {
        callback(null, uploadsPath);
    },

    filename: (
        _req,
        file,
        callback,
    ) => {
        const extension = path
            .extname(file.originalname)
            .toLowerCase();

        const storedName =
            `${Date.now()}-${crypto.randomUUID()}${extension}`;

        callback(null, storedName);
    },
});

const upload = multer({
    storage,

    limits: {
        fileSize:
            100 * 1024 * 1024,
    },

    fileFilter: (
        _req,
        file,
        callback,
    ) => {
        const extension = path
            .extname(file.originalname)
            .toLowerCase();

        const isPdf =
            file.mimetype ===
                "application/pdf" &&
            extension === ".pdf";

        if (!isPdf) {
            callback(
                new Error(
                    "Only PDF files are allowed.",
                ),
            );

            return;
        }

        callback(null, true);
    },
});

async function readDb() {
    try {
        const fileContents =
            await fs.readFile(
                dbPath,
                "utf-8",
            );

        const parsedData =
            JSON.parse(fileContents);

        if (
            !parsedData ||
            typeof parsedData !== "object" ||
            Array.isArray(parsedData)
        ) {
            return {
                quotedJobs: [],
            };
        }

        if (
            !Array.isArray(
                parsedData.quotedJobs,
            )
        ) {
            parsedData.quotedJobs = [];
        }

        if (
            !parsedData.counters ||
            typeof parsedData.counters !==
                "object"
        ) {
            parsedData.counters = {};
        }

        if (
            !Number.isFinite(
                parsedData.counters
                    .nextQuoteNumber,
            )
        ) {
            parsedData.counters.nextQuoteNumber = 1;
        }

        if (
            !Number.isFinite(
                parsedData.counters
                    .nextInvoiceNumber,
            )
        ) {
            parsedData.counters.nextInvoiceNumber = 1;
        }

        if (
            !Array.isArray(
                parsedData.beamTypes,
            )
        ) {
            parsedData.beamTypes = [];
        }

        if (
            !Array.isArray(
                parsedData.scalePresets,
            )
        ) {
            parsedData.scalePresets = [];
        }

        if (
            !Array.isArray(
                parsedData.scheduleEntries,
            )
        ) {
            parsedData.scheduleEntries = [];
        }

        if (!Array.isArray(parsedData.todos)) {
            parsedData.todos = [];
        }

        return parsedData;
    } catch (error) {
        if (error.code === "ENOENT") {
            const initialDb = {
                quotedJobs: [],
                counters: {
                    nextQuoteNumber: 1,
                    nextInvoiceNumber: 1,
                },
                beamTypes: [],
                scalePresets: [],
                scheduleEntries: [],
                todos: [],
            };

            await writeDb(initialDb);

            return initialDb;
        }

        throw error;
    }
}

async function writeDb(data) {
    await fs.writeFile(
        dbPath,
        JSON.stringify(
            data,
            null,
            2,
        ),
        "utf-8",
    );
}

function toNumber(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return 0;
    }

    const parsedValue =
        Number(value);

    return Number.isFinite(
        parsedValue,
    )
        ? parsedValue
        : 0;
}

function toOptionalNumber(
    value,
    existingValue = 0,
) {
    if (value === undefined) {
        return existingValue;
    }

    return toNumber(value);
}

function toBoolean(value) {
    return (
        value === true ||
        value === "true"
    );
}

function toOptionalBoolean(
    value,
    existingValue = false,
) {
    if (value === undefined) {
        return existingValue;
    }

    return toBoolean(value);
}

/**
 * Resolves the number to assign for a manually-overridable sequence
 * (quote number / invoice number). A blank manual value consumes the
 * next counter value; a provided one is used as-is and advances the
 * counter so future auto-assigned numbers never fall behind it.
 */
// Where an invoice is up to. (No "Draft": invoices here are already issued.)
const INVOICE_STATUSES = ["Sent", "Paid", "Overdue"];

function assignSequenceNumber(
    counters,
    counterKey,
    manualValue,
) {
    if (
        manualValue !== undefined &&
        manualValue !== null &&
        String(manualValue).trim() !== ""
    ) {
        const parsed = Number(
            manualValue,
        );

        if (
            !Number.isFinite(parsed) ||
            parsed <= 0
        ) {
            return {
                error:
                    "Number must be a positive value.",
            };
        }

        counters[counterKey] = Math.max(
            counters[counterKey],
            parsed + 1,
        );

        return { number: parsed };
    }

    const number = counters[counterKey];
    counters[counterKey] = number + 1;

    return { number };
}

function createFileRecord(file) {
    return {
        id: crypto.randomUUID(),

        name: path.parse(
            file.originalname,
        ).name,

        originalName:
            file.originalname,

        storedName:
            file.filename,

        mimeType:
            file.mimetype,

        size: file.size,

        path:
            `/uploads/${file.filename}`,

        url:
            `/uploads/${file.filename}`,

        uploadedAt:
            new Date().toISOString(),
    };
}

async function deleteStoredFile(
    storedName,
) {
    if (!storedName) {
        return;
    }

    const filePath = path.join(
        uploadsPath,
        storedName,
    );

    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
}

/**
 * Get all quotes
 */
app.get(
    "/api/quoted-jobs",
    async (_req, res) => {
        try {
            const db =
                await readDb();

            return res.json(
                db.quotedJobs,
            );
        } catch (error) {
            console.error(
                "Failed to load quoted jobs:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to load quoted jobs",
                });
        }
    },
);

/**
 * Get the next quote/invoice numbers that will be auto-assigned
 */
app.get(
    "/api/counters",
    async (_req, res) => {
        try {
            const db =
                await readDb();

            return res.json(
                db.counters,
            );
        } catch (error) {
            console.error(
                "Failed to load counters:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to load counters",
                });
        }
    },
);

/**
 * Get the shared steel beam type catalogue
 */
app.get(
    "/api/beam-types",
    async (_req, res) => {
        try {
            const db =
                await readDb();

            return res.json(
                db.beamTypes,
            );
        } catch (error) {
            console.error(
                "Failed to load beam types:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to load beam types",
                });
        }
    },
);

/**
 * Create a steel beam type
 */
app.post(
    "/api/beam-types",
    async (req, res) => {
        try {
            const name = (
                req.body.name ?? ""
            ).trim();

            const kgPerMetre = Number(
                req.body.kgPerMetre,
            );

            if (!name) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Name is required.",
                    });
            }

            if (
                !Number.isFinite(
                    kgPerMetre,
                ) ||
                kgPerMetre <= 0
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "kg/m must be a positive number.",
                    });
            }

            const db =
                await readDb();

            const beamType = {
                id: crypto.randomUUID(),
                name,
                kgPerMetre,
            };

            db.beamTypes.push(
                beamType,
            );

            await writeDb(db);

            return res
                .status(201)
                .json(beamType);
        } catch (error) {
            console.error(
                "Failed to create beam type:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to create beam type",
                });
        }
    },
);

/**
 * Get the shared scale preset catalogue
 */
app.get(
    "/api/scale-presets",
    async (_req, res) => {
        try {
            const db =
                await readDb();

            return res.json(
                db.scalePresets,
            );
        } catch (error) {
            console.error(
                "Failed to load scale presets:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to load scale presets",
                });
        }
    },
);

/**
 * Save a scale preset
 */
app.post(
    "/api/scale-presets",
    async (req, res) => {
        try {
            const name = (
                req.body.name ?? ""
            ).trim();

            if (!name) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Name is required.",
                    });
            }

            const {
                primaryAxis,
                secondaryAxis,
            } = req.body;

            if (
                !primaryAxis ||
                typeof primaryAxis !==
                    "object" ||
                !secondaryAxis ||
                typeof secondaryAxis !==
                    "object"
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "A calibrated scale is required.",
                    });
            }

            const db =
                await readDb();

            const scalePreset = {
                id: crypto.randomUUID(),
                name,
                primaryAxis,
                secondaryAxis,
            };

            db.scalePresets.push(
                scalePreset,
            );

            await writeDb(db);

            return res
                .status(201)
                .json(scalePreset);
        } catch (error) {
            console.error(
                "Failed to save scale preset:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to save scale preset",
                });
        }
    },
);

/**
 * Get one quote
 */
app.get(
    "/api/quoted-jobs/:id",
    async (req, res) => {
        try {
            const db =
                await readDb();

            const job =
                db.quotedJobs.find(
                    (item) =>
                        item.id ===
                        req.params.id,
                );

            if (!job) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Quote not found",
                    });
            }

            return res.json({
                ...job,
                files:
                    job.files ?? [],
                takeoff:
                    job.takeoff ?? null,
                takeoffByFile:
                    job.takeoffByFile ?? {},
                invoices:
                    job.invoices ?? [],
            });
        } catch (error) {
            console.error(
                "Failed to load quote:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to load quote",
                });
        }
    },
);

/**
 * Create quote
 */
app.post(
    "/api/quoted-jobs",
    upload.array("files"),
    async (req, res) => {
        try {
            const db =
                await readDb();

            const existingQuoteNumbers =
                new Set(
                    db.quotedJobs
                        .map(
                            (job) =>
                                job.quoteNumber,
                        )
                        .filter((value) =>
                            Number.isFinite(
                                value,
                            ),
                        ),
                );

            const quoteNumberResult =
                assignSequenceNumber(
                    db.counters,
                    "nextQuoteNumber",
                    req.body.quoteNumber,
                );

            if (quoteNumberResult.error) {
                return res
                    .status(400)
                    .json({
                        message:
                            quoteNumberResult.error,
                    });
            }

            if (
                existingQuoteNumbers.has(
                    quoteNumberResult.number,
                )
            ) {
                return res
                    .status(400)
                    .json({
                        message: `Quote number ${quoteNumberResult.number} is already in use.`,
                    });
            }

            const uploadedFiles = (
                Array.isArray(req.files)
                    ? req.files
                    : []
            ).map(createFileRecord);

            const newQuote = {
                id: crypto.randomUUID(),

                quoteNumber:
                    quoteNumberResult.number,

                status:
                    req.body.status ||
                    "Quoted",

                name:
                    req.body.name ||
                    "",

                address:
                    req.body.address ||
                    "",

                quotedAmount:
                    toNumber(
                        req.body
                            .quotedAmount,
                    ),

                gst:
                    toNumber(
                        req.body.gst,
                    ),

                inclGst:
                    toNumber(
                        req.body.inclGst,
                    ),

                wallsRoofRate:
                    toNumber(
                        req.body
                            .wallsRoofRate,
                    ),

                floorRate:
                    toNumber(
                        req.body.floorRate,
                    ),

                ffw:
                    toNumber(
                        req.body.ffw,
                    ),

                gfw:
                    toNumber(
                        req.body.gfw,
                    ),

                floor:
                    toNumber(
                        req.body.floor,
                    ),

                roof:
                    toNumber(
                        req.body.roof,
                    ),

                additionalCost:
                    toNumber(
                        req.body
                            .additionalCost,
                    ),

                steel:
                    toNumber(
                        req.body.steel,
                    ),

                hasSecondFloor:
                    toBoolean(
                        req.body
                            .hasSecondFloor,
                    ),

                hasHebel:
                    toBoolean(
                        req.body.hasHebel,
                    ),

                hebelHeight:
                    toNumber(
                        req.body
                            .hebelHeight,
                    ),

                hebelLength:
                    toNumber(
                        req.body
                            .hebelLength,
                    ),

                hebelRate:
                    toNumber(
                        req.body
                            .hebelRate,
                    ),

                hebelCost:
                    toNumber(
                        req.body
                            .hebelCost,
                    ),

                takeoff: null,

                invoices: [],

                files:
                    uploadedFiles,

                date:
                    new Date()
                        .toISOString(),

                updatedAt:
                    new Date()
                        .toISOString(),
            };

            db.quotedJobs.unshift(
                newQuote,
            );

            await writeDb(db);

            return res
                .status(201)
                .json(newQuote);
        } catch (error) {
            console.error(
                "Failed to create quote:",
                error,
            );

            if (
                Array.isArray(
                    req.files,
                )
            ) {
                await Promise.all(
                    req.files.map(
                        (file) =>
                            deleteStoredFile(
                                file.filename,
                            ).catch(
                                console.error,
                            ),
                    ),
                );
            }

            return res
                .status(500)
                .json({
                    message:
                        "Failed to create quote",
                });
        }
    },
);

/**
 * Update quote details and takeoff data
 */
app.patch(
    "/api/quoted-jobs/:id",
    async (req, res) => {
        try {
            const db =
                await readDb();

            const jobIndex =
                db.quotedJobs.findIndex(
                    (job) =>
                        job.id ===
                        req.params.id,
                );

            if (jobIndex === -1) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Quote not found",
                    });
            }

            const existingQuote =
                db.quotedJobs[
                    jobIndex
                ];

            const updatedQuote = {
                ...existingQuote,

                name:
                    req.body.name ??
                    existingQuote.name,

                address:
                    req.body.address ??
                    existingQuote.address,

                status:
                    req.body.status ??
                    existingQuote.status ??
                    "Quoted",

                invoiced:
                    typeof req.body.invoiced ===
                    "boolean"
                        ? req.body.invoiced
                        : (existingQuote.invoiced ??
                          false),

                quotedAmount:
                    toOptionalNumber(
                        req.body
                            .quotedAmount,
                        existingQuote
                            .quotedAmount,
                    ),

                gst:
                    toOptionalNumber(
                        req.body.gst,
                        existingQuote.gst,
                    ),

                inclGst:
                    toOptionalNumber(
                        req.body.inclGst,
                        existingQuote
                            .inclGst,
                    ),

                wallsRoofRate:
                    toOptionalNumber(
                        req.body
                            .wallsRoofRate,
                        existingQuote
                            .wallsRoofRate,
                    ),

                floorRate:
                    toOptionalNumber(
                        req.body.floorRate,
                        existingQuote
                            .floorRate,
                    ),

                ffw:
                    toOptionalNumber(
                        req.body.ffw,
                        existingQuote.ffw,
                    ),

                gfw:
                    toOptionalNumber(
                        req.body.gfw,
                        existingQuote.gfw,
                    ),

                floor:
                    toOptionalNumber(
                        req.body.floor,
                        existingQuote.floor,
                    ),

                roof:
                    toOptionalNumber(
                        req.body.roof,
                        existingQuote.roof,
                    ),

                additionalCost:
                    toOptionalNumber(
                        req.body
                            .additionalCost,
                        existingQuote
                            .additionalCost,
                    ),

                steel:
                    toOptionalNumber(
                        req.body.steel,
                        existingQuote.steel,
                    ),

                hasSecondFloor:
                    toOptionalBoolean(
                        req.body
                            .hasSecondFloor,
                        existingQuote
                            .hasSecondFloor,
                    ),

                hasHebel:
                    toOptionalBoolean(
                        req.body.hasHebel,
                        existingQuote
                            .hasHebel,
                    ),

                hebelHeight:
                    toOptionalNumber(
                        req.body
                            .hebelHeight,
                        existingQuote
                            .hebelHeight,
                    ),

                hebelLength:
                    toOptionalNumber(
                        req.body
                            .hebelLength,
                        existingQuote
                            .hebelLength,
                    ),

                hebelRate:
                    toOptionalNumber(
                        req.body
                            .hebelRate,
                        existingQuote
                            .hebelRate,
                    ),

                hebelCost:
                    toOptionalNumber(
                        req.body
                            .hebelCost,
                        existingQuote
                            .hebelCost,
                    ),

                takeoff:
                    req.body.takeoff !==
                    undefined
                        ? req.body.takeoff
                        : existingQuote
                              .takeoff ??
                          null,

                takeoffByFile:
                    req.body
                        .takeoffByFile !==
                    undefined
                        ? req.body
                              .takeoffByFile
                        : existingQuote
                              .takeoffByFile ??
                          {},

                markupEditor:
                    req.body
                        .markupEditor !==
                    undefined
                        ? req.body
                              .markupEditor
                        : existingQuote
                              .markupEditor ??
                          null,

                files:
                    existingQuote.files ??
                    [],

                updatedAt:
                    new Date()
                        .toISOString(),
            };

            db.quotedJobs[jobIndex] =
                updatedQuote;

            await writeDb(db);

            return res
                .status(200)
                .json(updatedQuote);
        } catch (error) {
            console.error(
                "Failed to update quote:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to update quote",
                });
        }
    },
);

/**
 * Create an invoice against a quoted job
 */
app.post(
    "/api/quoted-jobs/:id/invoices",
    async (req, res) => {
        try {
            const db = await readDb();

            const jobIndex =
                db.quotedJobs.findIndex(
                    (job) =>
                        job.id ===
                        req.params.id,
                );

            if (jobIndex === -1) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Quote not found",
                    });
            }

            const description =
                (
                    req.body.description ?? ""
                ).trim() || "Carpentry works";

            const status =
                req.body.status ?? "Sent";

            if (
                !INVOICE_STATUSES.includes(
                    status,
                )
            ) {
                return res
                    .status(400)
                    .json({
                        message: `Status must be one of: ${INVOICE_STATUSES.join(", ")}.`,
                    });
            }

            const amountIncGst = Number(
                req.body.amountIncGst,
            );

            if (
                !Number.isFinite(
                    amountIncGst,
                ) ||
                amountIncGst <= 0
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Amount must be a positive number.",
                    });
            }

            const existingInvoiceNumbers =
                new Set(
                    db.quotedJobs.flatMap(
                        (job) =>
                            (
                                job.invoices ??
                                []
                            ).map(
                                (invoice) =>
                                    invoice.invoiceNumber,
                            ),
                    ),
                );

            const invoiceNumberResult =
                assignSequenceNumber(
                    db.counters,
                    "nextInvoiceNumber",
                    req.body.invoiceNumber,
                );

            if (
                invoiceNumberResult.error
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            invoiceNumberResult.error,
                    });
            }

            if (
                existingInvoiceNumbers.has(
                    invoiceNumberResult.number,
                )
            ) {
                return res
                    .status(400)
                    .json({
                        message: `Invoice number ${invoiceNumberResult.number} is already in use.`,
                    });
            }

            const job =
                db.quotedJobs[jobIndex];

            const priorInvoices =
                job.invoices ?? [];

            const amountPaidToDate =
                priorInvoices.reduce(
                    (sum, invoice) =>
                        sum +
                        (Number(
                            invoice.amountIncGst,
                        ) || 0),
                    0,
                );

            const gst =
                Math.round(
                    (amountIncGst / 11) *
                        100,
                ) / 100;

            const newInvoice = {
                id: crypto.randomUUID(),
                invoiceNumber:
                    invoiceNumberResult.number,
                description,
                amountIncGst,
                gst,
                amountExGst:
                    Math.round(
                        (amountIncGst -
                            gst) *
                            100,
                    ) / 100,
                amountPaidToDate,
                status,
                date:
                    req.body.date ||
                    new Date().toISOString(),
                createdAt:
                    new Date().toISOString(),
            };

            job.invoices = [
                ...priorInvoices,
                newInvoice,
            ];
            // Issuing an invoice means the job has been invoiced.
            job.invoiced = true;
            job.updatedAt =
                new Date().toISOString();

            await writeDb(db);

            return res
                .status(201)
                .json(newInvoice);
        } catch (error) {
            console.error(
                "Failed to create invoice:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to create invoice",
                });
        }
    },
);

/**
 * Download an invoice: ".docx" is your Word template with the details
 * filled in; ".pdf" is the blank PDF form with the details stamped on.
 * Both are built here in the app; nothing else is opened or called.
 */
const INVOICE_FILES = {
    docx: {
        build: async (data) => buildInvoiceDocx(data),
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    pdf: {
        build: (data) => buildInvoicePdf(data),
        type: "application/pdf",
    },
};

app.get(
    "/api/quoted-jobs/:jobId/invoices/:invoiceId/:format",
    async (req, res) => {
        try {
            if (
                !Object.hasOwn(
                    INVOICE_FILES,
                    req.params.format,
                )
            ) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Unknown invoice format",
                    });
            }

            const db = await readDb();

            const job = db.quotedJobs.find(
                (item) =>
                    item.id ===
                    req.params.jobId,
            );

            const invoice = (
                job?.invoices ?? []
            ).find(
                (item) =>
                    item.id ===
                    req.params.invoiceId,
            );

            if (!job || !invoice) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Invoice not found",
                    });
            }

            // The date as it was entered (the calendar day, not a timezone).
            const [year, month, day] =
                String(invoice.date)
                    .slice(0, 10)
                    .split("-")
                    .map(Number);

            const { build, type } =
                INVOICE_FILES[
                    req.params.format
                ];

            const file = await build({
                clientName: job.name,
                address: job.address,
                invoiceNumber:
                    invoice.invoiceNumber,
                date: new Date(
                    year,
                    month - 1,
                    day,
                ),
                description:
                    invoice.description,
                amountExGst:
                    invoice.amountExGst,
                gst: invoice.gst,
                amountIncGst:
                    invoice.amountIncGst,
            });

            const filename =
                `${job.address || job.name} - Advance Carpentry Services Pty Ltd Invoice ${invoice.invoiceNumber}.${req.params.format}`.replace(
                    /[\\/:*?"<>|]+/g,
                    "-",
                );

            res.setHeader(
                "Content-Type",
                type,
            );
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="Invoice ${invoice.invoiceNumber}.${req.params.format}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
            );

            return res.send(
                Buffer.from(file),
            );
        } catch (error) {
            console.error(
                "Failed to build invoice file:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Couldn't create the invoice file",
                });
        }
    },
);

/**
 * Quote documents: the scope-of-work list, number and price for a job, kept on
 * job.quote, plus Word / PDF downloads built from it.
 */
const QUOTE_FILES = {
    docx: {
        build: buildQuoteDocx,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    pdf: { build: buildQuotePdf, type: "application/pdf" },
};

const roundCents = (value) => Math.round(value * 100) / 100;

app.post("/api/quoted-jobs/:id/quote", async (req, res) => {
    try {
        const db = await readDb();
        const job = db.quotedJobs.find((item) => item.id === req.params.id);

        if (!job) {
            return res.status(404).json({ message: "Quote not found" });
        }

        const body = req.body ?? {};
        const scope = Array.isArray(body.scope)
            ? body.scope.map((line) => String(line).trim()).filter(Boolean)
            : [];
        const inclGst = Number(body.inclGst);
        const to = String(body.to ?? "").trim();
        const site = String(body.site ?? "").trim();

        if (scope.length === 0) {
            return res.status(400).json({ message: "Add at least one line to the scope." });
        }

        if (!Number.isFinite(inclGst) || inclGst <= 0) {
            return res.status(400).json({ message: "Price must be a positive number." });
        }

        if (!to || !site) {
            return res.status(400).json({ message: "Client and site address are required." });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) {
            return res.status(400).json({ message: "Date is required." });
        }

        const usedBy = (number) =>
            db.quotedJobs.some(
                (other) =>
                    other.id !== job.id &&
                    (Number(other.quoteNumber) === number ||
                        Number(other.quote?.number) === number),
            );

        // Jobs numbered 1-17 predate the real quote numbers (now 1500s+), so
        // those don't count as this job's quote number.
        const current = Number(job.quote?.number ?? job.quoteNumber);
        let number = current >= (job.quote ? 1 : 1000) ? current : null;
        const manual = String(body.number ?? "").trim();

        if (manual !== "" && Number(manual) !== number) {
            const result = assignSequenceNumber(db.counters, "nextQuoteNumber", manual);

            if (result.error) {
                return res.status(400).json({ message: result.error });
            }

            if (usedBy(result.number)) {
                return res
                    .status(409)
                    .json({ message: `Quote number ${result.number} is already in use.` });
            }

            number = result.number;
        } else if (!number) {
            do {
                number = assignSequenceNumber(db.counters, "nextQuoteNumber").number;
            } while (usedBy(number));
        }

        const cash = body.cash === true;
        const gst = cash ? 0 : roundCents(inclGst / 11);

        // The job's price follows its quote: ex GST, GST and inc GST.
        job.quotedAmount = roundCents(inclGst - gst);
        job.gst = gst;
        job.inclGst = inclGst;
        job.quoteNumber = number;
        job.quote = {
            ...job.quote,
            number,
            date: body.date,
            to,
            site,
            scope,
            options: body.options ?? job.quote?.options,
            kind: body.options?.type ?? job.quote?.kind,
            cash,
            exGst: roundCents(inclGst - gst),
            gst,
            inclGst,
            savedAt: new Date().toISOString(),
        };

        await writeDb(db);

        return res.json(job.quote);
    } catch (error) {
        console.error("Failed to save quote:", error);

        return res.status(500).json({ message: "Couldn't save the quote" });
    }
});

app.get("/api/quoted-jobs/:id/quote/:format", async (req, res) => {
    try {
        if (!Object.hasOwn(QUOTE_FILES, req.params.format)) {
            return res.status(404).json({ message: "Unknown quote format" });
        }

        const db = await readDb();
        const job = db.quotedJobs.find((item) => item.id === req.params.id);
        const quote = job?.quote;

        if (!quote) {
            return res.status(404).json({ message: "This job has no quote yet" });
        }

        const [year, month, day] = String(quote.date).slice(0, 10).split("-").map(Number);
        const { build, type } = QUOTE_FILES[req.params.format];
        const site = quote.site || job.address;

        const file = await build({
            to: quote.to || job.name,
            site,
            date: new Date(year, month - 1, day),
            number: quote.number,
            scope: quote.scope,
            exGst: quote.exGst,
            gst: quote.gst,
            inclGst: quote.inclGst,
            cash: quote.cash === true,
        });

        const filename =
            `${site} - Advance Carpentry Services Pty Ltd Quotation.${req.params.format}`.replace(
                /[\\/:*?"<>|]+/g,
                "-",
            );

        res.setHeader("Content-Type", type);
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="Quote ${quote.number}.${req.params.format}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        );

        return res.send(Buffer.from(file));
    } catch (error) {
        console.error("Failed to build quote file:", error);

        return res.status(500).json({ message: "Couldn't create the quote file" });
    }
});

/**
 * SWMS: your Word template with the few per-job fields swapped in (and the same
 * thing as a PDF). Principal contractor, person responsible and the workers list
 * are remembered from the last one made.
 */
const SWMS_FILES = {
    docx: {
        build: buildSwmsDocx,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    pdf: { build: buildSwmsPdf, type: "application/pdf" },
};

app.get("/api/swms/defaults", async (_req, res) => {
    try {
        const db = await readDb();

        return res.json({ ...TEMPLATE_DEFAULTS, ...db.swmsDefaults, maxWorkers: MAX_WORKERS });
    } catch (error) {
        console.error("Failed to load SWMS defaults:", error);

        return res.status(500).json({ message: "Couldn't load the SWMS details" });
    }
});

app.post("/api/swms/:format", async (req, res) => {
    try {
        if (!Object.hasOwn(SWMS_FILES, req.params.format)) {
            return res.status(404).json({ message: "Unknown SWMS format" });
        }

        const body = req.body ?? {};
        const text = (value) => String(value ?? "").trim();
        const principalContractor = text(body.principalContractor);
        const person = text(body.person);
        const location = text(body.location);
        const workers = (Array.isArray(body.workers) ? body.workers : [])
            .map(text)
            .filter(Boolean);

        if (!principalContractor || !person || !location) {
            return res.status(400).json({
                message: "Workplace location, person responsible and principal contractor are required.",
            });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) {
            return res.status(400).json({ message: "Date is required." });
        }

        if (workers.length > MAX_WORKERS) {
            return res.status(400).json({ message: `At most ${MAX_WORKERS} workers fit on the SWMS.` });
        }

        const [year, month, day] = body.date.split("-").map(Number);
        const { build, type } = SWMS_FILES[req.params.format];

        const file = await build({
            principalContractor,
            person,
            location,
            date: new Date(year, month - 1, day),
            workers,
        });

        // Remember these for next time (not the date or the location).
        const db = await readDb();

        db.swmsDefaults = { principalContractor, person, workers };
        await writeDb(db);

        const filename = `SWMS - ${location}.${req.params.format}`.replace(/[\\/:*?"<>|]+/g, "-");

        res.setHeader("Content-Type", type);
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="SWMS.${req.params.format}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        );

        return res.send(Buffer.from(file));
    } catch (error) {
        console.error("Failed to build SWMS:", error);

        return res.status(500).json({ message: "Couldn't create the SWMS" });
    }
});

/**
 * Change an invoice's status (Sent / Paid / Overdue)
 */
app.patch(
    "/api/quoted-jobs/:jobId/invoices/:invoiceId",
    async (req, res) => {
        try {
            const db = await readDb();

            const job = db.quotedJobs.find(
                (item) =>
                    item.id ===
                    req.params.jobId,
            );

            const invoice = (
                job?.invoices ?? []
            ).find(
                (item) =>
                    item.id ===
                    req.params.invoiceId,
            );

            if (!job || !invoice) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Invoice not found",
                    });
            }

            if (
                !INVOICE_STATUSES.includes(
                    req.body.status,
                )
            ) {
                return res
                    .status(400)
                    .json({
                        message: `Status must be one of: ${INVOICE_STATUSES.join(", ")}.`,
                    });
            }

            invoice.status =
                req.body.status;
            job.updatedAt =
                new Date().toISOString();

            await writeDb(db);

            return res.json(invoice);
        } catch (error) {
            console.error(
                "Failed to update invoice:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to update invoice",
                });
        }
    },
);

/**
 * Upload one PDF
 */
app.post(
    "/api/quoted-jobs/:id/files",
    upload.single("file"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res
                    .status(400)
                    .json({
                        message:
                            "No PDF file was uploaded",
                    });
            }

            const db =
                await readDb();

            const jobIndex =
                db.quotedJobs.findIndex(
                    (job) =>
                        job.id ===
                        req.params.id,
                );

            if (jobIndex === -1) {
                await deleteStoredFile(
                    req.file.filename,
                );

                return res
                    .status(404)
                    .json({
                        message:
                            "Quote not found",
                    });
            }

            const fileRecord =
                createFileRecord(
                    req.file,
                );

            const existingQuote =
                db.quotedJobs[
                    jobIndex
                ];

            db.quotedJobs[jobIndex] = {
                ...existingQuote,

                files: [
                    ...(
                        existingQuote.files ??
                        []
                    ),

                    fileRecord,
                ],

                updatedAt:
                    new Date()
                        .toISOString(),
            };

            await writeDb(db);

            return res
                .status(201)
                .json(fileRecord);
        } catch (error) {
            console.error(
                "Failed to upload PDF:",
                error,
            );

            if (
                req.file?.filename
            ) {
                await deleteStoredFile(
                    req.file.filename,
                ).catch(
                    console.error,
                );
            }

            return res
                .status(500)
                .json({
                    message:
                        "Failed to upload PDF",
                });
        }
    },
);

/**
 * Upload multiple PDFs
 */
app.post(
    "/api/quoted-jobs/:id/files/multiple",
    upload.array("files"),
    async (req, res) => {
        try {
            const uploadedFiles =
                Array.isArray(
                    req.files,
                )
                    ? req.files
                    : [];

            if (
                uploadedFiles.length ===
                0
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            "No PDF files were uploaded",
                    });
            }

            const db =
                await readDb();

            const jobIndex =
                db.quotedJobs.findIndex(
                    (job) =>
                        job.id ===
                        req.params.id,
                );

            if (jobIndex === -1) {
                await Promise.all(
                    uploadedFiles.map(
                        (file) =>
                            deleteStoredFile(
                                file.filename,
                            ),
                    ),
                );

                return res
                    .status(404)
                    .json({
                        message:
                            "Quote not found",
                    });
            }

            const fileRecords =
                uploadedFiles.map(
                    createFileRecord,
                );

            const existingQuote =
                db.quotedJobs[
                    jobIndex
                ];

            db.quotedJobs[jobIndex] = {
                ...existingQuote,

                files: [
                    ...(
                        existingQuote.files ??
                        []
                    ),

                    ...fileRecords,
                ],

                updatedAt:
                    new Date()
                        .toISOString(),
            };

            await writeDb(db);

            return res
                .status(201)
                .json(fileRecords);
        } catch (error) {
            console.error(
                "Failed to upload PDFs:",
                error,
            );

            if (
                Array.isArray(
                    req.files,
                )
            ) {
                await Promise.all(
                    req.files.map(
                        (file) =>
                            deleteStoredFile(
                                file.filename,
                            ).catch(
                                console.error,
                            ),
                    ),
                );
            }

            return res
                .status(500)
                .json({
                    message:
                        "Failed to upload PDFs",
                });
        }
    },
);

/**
 * Delete one attached file
 */
app.delete(
    "/api/quoted-jobs/:jobId/files/:fileId",
    async (req, res) => {
        try {
            const db =
                await readDb();

            const jobIndex =
                db.quotedJobs.findIndex(
                    (job) =>
                        job.id ===
                        req.params
                            .jobId,
                );

            if (jobIndex === -1) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Quote not found",
                    });
            }

            const existingQuote =
                db.quotedJobs[
                    jobIndex
                ];

            const files =
                existingQuote.files ??
                [];

            const fileToDelete =
                files.find(
                    (file) =>
                        file.id ===
                        req.params
                            .fileId,
                );

            if (!fileToDelete) {
                return res
                    .status(404)
                    .json({
                        message:
                            "File not found",
                    });
            }

            db.quotedJobs[jobIndex] = {
                ...existingQuote,

                files:
                    files.filter(
                        (file) =>
                            file.id !==
                            req.params
                                .fileId,
                    ),

                updatedAt:
                    new Date()
                        .toISOString(),
            };

            await writeDb(db);

            await deleteStoredFile(
                fileToDelete.storedName,
            );

            return res
                .status(200)
                .json({
                    message:
                        "File deleted successfully",
                });
        } catch (error) {
            console.error(
                "Failed to delete file:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to delete file",
                });
        }
    },
);

/**
 * Delete quote and its files
 */
app.delete(
    "/api/quoted-jobs/:id",
    async (req, res) => {
        try {
            const db =
                await readDb();

            const quoteToDelete =
                db.quotedJobs.find(
                    (job) =>
                        job.id ===
                        req.params.id,
                );

            if (!quoteToDelete) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Quote not found",
                    });
            }

            db.quotedJobs =
                db.quotedJobs.filter(
                    (job) =>
                        job.id !==
                        req.params.id,
                );

            db.scheduleEntries =
                db.scheduleEntries.filter(
                    (entry) =>
                        entry.jobId !==
                        req.params.id,
                );

            await writeDb(db);

            if (
                Array.isArray(
                    quoteToDelete.files,
                )
            ) {
                await Promise.all(
                    quoteToDelete.files.map(
                        (file) =>
                            deleteStoredFile(
                                file.storedName,
                            ).catch(
                                (error) => {
                                    console.error(
                                        "Failed to delete attached file:",
                                        error,
                                    );
                                },
                            ),
                    ),
                );
            }

            return res
                .status(200)
                .json({
                    message:
                        "Quote deleted successfully",
                });
        } catch (error) {
            console.error(
                "Failed to delete quote:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to delete quote",
                });
        }
    },
);

/**
 * Schedule: one entry = one row on the schedule = one block of
 * consecutive working days (Mon-Sat) for a job. Dates are local
 * "YYYY-MM-DD" strings so there is no timezone drift.
 */
function isValidScheduleDate(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
            value,
        )
    ) {
        return false;
    }

    const [year, month, day] =
        value.split("-").map(Number);
    const date = new Date(
        year,
        month - 1,
        day,
    );

    // Real calendar date, and never a Sunday (schedule skips Sundays).
    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day &&
        date.getDay() !== 0
    );
}

function validateScheduleDates(
    start,
    end,
) {
    if (
        !isValidScheduleDate(start) ||
        !isValidScheduleDate(end)
    ) {
        return "Start and end must be valid YYYY-MM-DD dates that are not Sundays.";
    }

    if (end < start) {
        return "End date cannot be before the start date.";
    }

    return null;
}

app.get(
    "/api/schedule",
    async (_req, res) => {
        try {
            const db =
                await readDb();

            return res.json(
                db.scheduleEntries,
            );
        } catch (error) {
            console.error(
                "Failed to load schedule:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to load schedule",
                });
        }
    },
);

app.post(
    "/api/schedule",
    async (req, res) => {
        try {
            const db =
                await readDb();

            const { jobId, start, end } =
                req.body;

            if (
                !db.quotedJobs.some(
                    (job) =>
                        job.id === jobId,
                )
            ) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Job not found",
                    });
            }

            const dateError =
                validateScheduleDates(
                    start,
                    end,
                );

            if (dateError) {
                return res
                    .status(400)
                    .json({
                        message:
                            dateError,
                    });
            }

            const entry = {
                id: crypto.randomUUID(),
                jobId,
                start,
                end,
            };

            db.scheduleEntries.push(
                entry,
            );

            await writeDb(db);

            return res
                .status(201)
                .json(entry);
        } catch (error) {
            console.error(
                "Failed to create schedule entry:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to create schedule entry",
                });
        }
    },
);

app.patch(
    "/api/schedule/:id",
    async (req, res) => {
        try {
            const db =
                await readDb();

            const entry =
                db.scheduleEntries.find(
                    (item) =>
                        item.id ===
                        req.params.id,
                );

            if (!entry) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Schedule entry not found",
                    });
            }

            const start =
                req.body.start ??
                entry.start;
            const end =
                req.body.end ??
                entry.end;

            const dateError =
                validateScheduleDates(
                    start,
                    end,
                );

            if (dateError) {
                return res
                    .status(400)
                    .json({
                        message:
                            dateError,
                    });
            }

            entry.start = start;
            entry.end = end;

            await writeDb(db);

            return res.json(entry);
        } catch (error) {
            console.error(
                "Failed to update schedule entry:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to update schedule entry",
                });
        }
    },
);

app.delete(
    "/api/schedule/:id",
    async (req, res) => {
        try {
            const db =
                await readDb();

            const before =
                db.scheduleEntries
                    .length;

            db.scheduleEntries =
                db.scheduleEntries.filter(
                    (item) =>
                        item.id !==
                        req.params.id,
                );

            if (
                db.scheduleEntries
                    .length === before
            ) {
                return res
                    .status(404)
                    .json({
                        message:
                            "Schedule entry not found",
                    });
            }

            await writeDb(db);

            return res.json({
                message:
                    "Schedule entry deleted",
            });
        } catch (error) {
            console.error(
                "Failed to delete schedule entry:",
                error,
            );

            return res
                .status(500)
                .json({
                    message:
                        "Failed to delete schedule entry",
                });
        }
    },
);

/**
 * Quick to-do list shown on the dashboard.
 */
app.get("/api/todos", async (_req, res) => {
    try {
        const db = await readDb();

        return res.json(db.todos);
    } catch (error) {
        console.error("Failed to load todos:", error);

        return res
            .status(500)
            .json({ message: "Failed to load todos" });
    }
});

app.post("/api/todos", async (req, res) => {
    try {
        const text =
            typeof req.body.text === "string"
                ? req.body.text.trim()
                : "";

        if (!text) {
            return res
                .status(400)
                .json({ message: "Todo text is required" });
        }

        const db = await readDb();
        const todo = {
            id: crypto.randomUUID(),
            text,
            done: false,
            createdAt: new Date().toISOString(),
        };

        db.todos.push(todo);
        await writeDb(db);

        return res.status(201).json(todo);
    } catch (error) {
        console.error("Failed to create todo:", error);

        return res
            .status(500)
            .json({ message: "Failed to create todo" });
    }
});

app.patch("/api/todos/:id", async (req, res) => {
    try {
        const db = await readDb();
        const todo = db.todos.find(
            (item) => item.id === req.params.id,
        );

        if (!todo) {
            return res
                .status(404)
                .json({ message: "Todo not found" });
        }

        if (typeof req.body.done === "boolean") {
            todo.done = req.body.done;
        }

        await writeDb(db);

        return res.json(todo);
    } catch (error) {
        console.error("Failed to update todo:", error);

        return res
            .status(500)
            .json({ message: "Failed to update todo" });
    }
});

// DELETE /api/todos/:id removes one; DELETE /api/todos clears all finished ones.
app.delete("/api/todos/:id", async (req, res) => {
    try {
        const db = await readDb();
        const before = db.todos.length;

        db.todos = db.todos.filter(
            (item) => item.id !== req.params.id,
        );

        if (db.todos.length === before) {
            return res
                .status(404)
                .json({ message: "Todo not found" });
        }

        await writeDb(db);

        return res.json({ message: "Todo deleted" });
    } catch (error) {
        console.error("Failed to delete todo:", error);

        return res
            .status(500)
            .json({ message: "Failed to delete todo" });
    }
});

app.delete("/api/todos", async (_req, res) => {
    try {
        const db = await readDb();

        db.todos = db.todos.filter((item) => !item.done);
        await writeDb(db);

        return res.json(db.todos);
    } catch (error) {
        console.error("Failed to clear todos:", error);

        return res
            .status(500)
            .json({ message: "Failed to clear todos" });
    }
});

/**
 * Employees: kept in their own git-ignored file (phones/emails stay off GitHub).
 * group: owner | abn | apprentice. plExpiry (YYYY-MM-DD) only matters for ABN.
 */
const employeesPath = path.join(__dirname, "..", "employees.json");
const EMPLOYEE_GROUPS = ["owner", "abn", "apprentice"];
const EMPLOYEE_TEXT_FIELDS = ["name", "role", "phone", "email", "abn", "notes"];

async function readEmployees() {
    try {
        return JSON.parse(await fs.readFile(employeesPath, "utf-8"));
    } catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }

        throw error;
    }
}

function applyEmployeeFields(employee, body) {
    for (const field of EMPLOYEE_TEXT_FIELDS) {
        if (typeof body[field] === "string") {
            employee[field] = body[field].trim();
        }
    }

    if (EMPLOYEE_GROUPS.includes(body.group)) {
        employee.group = body.group;
    }

    if (body.status === "active" || body.status === "inactive") {
        employee.status = body.status;
    }

    if (body.plExpiry === null || body.plExpiry === "") {
        employee.plExpiry = null;
    } else if (
        typeof body.plExpiry === "string" &&
        /^20\d{2}-\d{2}-\d{2}$/.test(body.plExpiry)
    ) {
        employee.plExpiry = body.plExpiry;
    }
}

// Related documents (certificates, contracts...) live in a git-ignored folder:
// employee-files/<employeeId>/<fileId>; names and types are kept on the record.
const employeeFilesRoot = path.join(__dirname, "..", "employee-files");
const employeeFilesDir = (employeeId) => path.join(employeeFilesRoot, path.basename(employeeId));
const employeeUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
});

// handler returns {status?, body} to save the list and reply, or replies itself.
function employeeRoute(handler) {
    return async (req, res) => {
        try {
            const employees = await readEmployees();
            const result = await handler(req, res, employees);

            if (result !== undefined && !res.headersSent) {
                await fs.writeFile(
                    employeesPath,
                    JSON.stringify(employees, null, 2),
                    "utf-8",
                );
                return res.status(result.status ?? 200).json(result.body);
            }
        } catch (error) {
            console.error("Employees request failed:", error);
            return res.status(500).json({ message: "Employees request failed" });
        }
    };
}

app.get("/api/employees", employeeRoute(async (_req, res, employees) => {
    res.json(employees);
}));

app.post("/api/employees", employeeRoute(async (req, res, employees) => {
    const employee = {
        id: crypto.randomUUID(),
        number: "",
        name: "",
        group: "abn",
        role: "",
        phone: "",
        email: "",
        abn: "",
        status: "active",
        plExpiry: null,
        notes: "",
    };

    applyEmployeeFields(employee, req.body);

    if (!employee.name) {
        return res.status(400).json({ message: "Name is required" });
    }

    employees.push(employee);

    return { status: 201, body: employee };
}));

app.patch("/api/employees/:id", employeeRoute(async (req, res, employees) => {
    const employee = employees.find((item) => item.id === req.params.id);

    if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
    }

    applyEmployeeFields(employee, req.body);

    return { body: employee };
}));

app.post(
    "/api/employees/:id/files",
    employeeUpload.array("files"),
    employeeRoute(async (req, res, employees) => {
        const employee = employees.find((item) => item.id === req.params.id);

        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        employee.files ??= [];
        await fs.mkdir(employeeFilesDir(employee.id), { recursive: true });

        for (const file of req.files ?? []) {
            const record = {
                id: crypto.randomUUID(),
                name: Buffer.from(file.originalname, "latin1").toString("utf8"),
                size: file.size,
                type: file.mimetype || "application/octet-stream",
                addedAt: new Date().toISOString(),
            };

            await fs.writeFile(path.join(employeeFilesDir(employee.id), record.id), file.buffer);
            employee.files.push(record);
        }

        return { status: 201, body: employee };
    }),
);

// Only PDFs and raster images open in the browser; everything else downloads.
app.get("/api/employees/:id/files/:fileId", employeeRoute(async (req, res, employees) => {
    const record = employees
        .find((item) => item.id === req.params.id)
        ?.files?.find((item) => item.id === req.params.fileId);

    if (!record) {
        return res.status(404).json({ message: "File not found" });
    }

    const inline = /^(application\/pdf|image\/(png|jpeg|gif|webp))$/.test(record.type);

    res.setHeader("Content-Type", inline ? record.type : "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
        "Content-Disposition",
        `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(record.name)}`,
    );

    return res.sendFile(path.join(employeeFilesDir(req.params.id), record.id));
}));

app.delete("/api/employees/:id/files/:fileId", employeeRoute(async (req, res, employees) => {
    const employee = employees.find((item) => item.id === req.params.id);
    const index = employee?.files?.findIndex((item) => item.id === req.params.fileId) ?? -1;

    if (index === -1) {
        return res.status(404).json({ message: "File not found" });
    }

    const [record] = employee.files.splice(index, 1);
    await fs.rm(path.join(employeeFilesDir(employee.id), record.id), { force: true });

    return { body: employee };
}));

app.delete("/api/employees/:id", employeeRoute(async (req, res, employees) => {
    const index = employees.findIndex((item) => item.id === req.params.id);

    if (index === -1) {
        return res.status(404).json({ message: "Employee not found" });
    }

    employees.splice(index, 1);
    await fs.rm(employeeFilesDir(req.params.id), { recursive: true, force: true });

    return { body: { message: "Employee deleted" } };
}));

/**
 * Multer and general errors
 */
app.use(
    (
        error,
        _req,
        res,
        _next,
    ) => {
        console.error(error);

        if (
            error instanceof
            multer.MulterError
        ) {
            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {
                return res
                    .status(413)
                    .json({
                        message:
                            "The PDF must be smaller than 100 MB",
                    });
            }

            return res
                .status(400)
                .json({
                    message:
                        error.message,
                });
        }

        if (
            error instanceof Error
        ) {
            return res
                .status(400)
                .json({
                    message:
                        error.message,
                });
        }

        return res
            .status(500)
            .json({
                message:
                    "Unexpected server error",
            });
    },
);

app.listen(PORT, () => {
    console.log(
        `Backend running on http://localhost:${PORT}`,
    );

    console.log(
        `Database: ${dbPath}`,
    );
});