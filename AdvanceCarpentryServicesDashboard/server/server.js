import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { promises as fs } from "fs";
import { existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3001;

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

            const description = (
                req.body.description ?? ""
            ).trim();

            if (!description) {
                return res
                    .status(400)
                    .json({
                        message:
                            "Description is required.",
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