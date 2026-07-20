import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "..", "db.json");
const uploadsPath = path.join(__dirname, "..", "uploads");

if (!existsSync(uploadsPath)) {
  mkdirSync(uploadsPath, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsPath));

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsPath);
  },

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const storedName = `${Date.now()}-${crypto.randomUUID()}${extension}`;

    callback(null, storedName);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 100 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const isPdf =
      file.mimetype === "application/pdf" &&
      extension === ".pdf";

    if (!isPdf) {
      callback(new Error("Only PDF files are allowed."));
      return;
    }

    callback(null, true);
  },
});

async function readDb() {
  const file = await fs.readFile(dbPath, "utf-8");
  return JSON.parse(file);
}

async function writeDb(data) {
  await fs.writeFile(
    dbPath,
    JSON.stringify(data, null, 2),
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

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
}

function toBoolean(value) {
  return value === true || value === "true";
}

function createFileRecord(file) {
  return {
    id: crypto.randomUUID(),
    name: path.parse(file.originalname).name,
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    path: `/uploads/${file.filename}`,
    url: `/uploads/${file.filename}`,
    uploadedAt: new Date().toISOString(),
  };
}

async function deleteStoredFile(storedName) {
  if (!storedName) return;

  const filePath = path.join(uploadsPath, storedName);

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
app.get("/api/quoted-jobs", async (_req, res) => {
  try {
    const db = await readDb();

    res.json(db.quotedJobs ?? []);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to load quoted jobs",
    });
  }
});

/**
 * Get one quote
 */
app.get("/api/quoted-jobs/:id", async (req, res) => {
  try {
    const db = await readDb();
    const jobId = req.params.id;

    const job = (db.quotedJobs ?? []).find(
      (item) => item.id === jobId,
    );

    if (!job) {
      return res.status(404).json({
        message: "Quote not found",
      });
    }

    res.json({
      ...job,
      files: job.files ?? [],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to load quote",
    });
  }
});

/**
 * Create quote with optional PDF files
 */
app.post(
  "/api/quoted-jobs",
  upload.array("files"),
  async (req, res) => {
    try {
      const db = await readDb();

      if (!Array.isArray(db.quotedJobs)) {
        db.quotedJobs = [];
      }

      const uploadedFiles = (
        Array.isArray(req.files) ? req.files : []
      ).map(createFileRecord);

      const newQuote = {
        id: crypto.randomUUID(),
        status: req.body.status || "Quoted",
        name: req.body.name || "",
        address: req.body.address || "",

        quotedAmount: toNumber(req.body.quotedAmount),
        gst: toNumber(req.body.gst),
        inclGst: toNumber(req.body.inclGst),

        wallsRoofRate: toNumber(
          req.body.wallsRoofRate,
        ),
        floorRate: toNumber(req.body.floorRate),
        ffw: toNumber(req.body.ffw),
        gfw: toNumber(req.body.gfw),
        floor: toNumber(req.body.floor),
        roof: toNumber(req.body.roof),
        additionalCost: toNumber(
          req.body.additionalCost,
        ),
        steel: toNumber(req.body.steel),

        hasSecondFloor: toBoolean(
          req.body.hasSecondFloor,
        ),

        hasHebel: toBoolean(req.body.hasHebel),
        hebelHeight: toNumber(
          req.body.hebelHeight,
        ),
        hebelLength: toNumber(
          req.body.hebelLength,
        ),
        hebelRate: toNumber(req.body.hebelRate),
        hebelCost: toNumber(req.body.hebelCost),

        files: uploadedFiles,
        date: new Date().toISOString(),
      };

      db.quotedJobs.unshift(newQuote);

      await writeDb(db);

      res.status(201).json(newQuote);
    } catch (error) {
      console.error(error);

      if (Array.isArray(req.files)) {
        await Promise.all(
          req.files.map((file) =>
            deleteStoredFile(file.filename).catch(
              console.error,
            ),
          ),
        );
      }

      res.status(500).json({
        message: "Failed to create quote",
      });
    }
  },
);

/**
 * Update quote details
 */
app.patch("/api/quoted-jobs/:id", async (req, res) => {
  try {
    const db = await readDb();
    const jobId = req.params.id;

    const jobIndex = (db.quotedJobs ?? []).findIndex(
      (job) => job.id === jobId,
    );

    if (jobIndex === -1) {
      return res.status(404).json({
        message: "Quote not found",
      });
    }

    const existingQuote = db.quotedJobs[jobIndex];

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
        req.body.quotedAmount !== undefined
          ? toNumber(req.body.quotedAmount)
          : existingQuote.quotedAmount,

      gst:
        req.body.gst !== undefined
          ? toNumber(req.body.gst)
          : existingQuote.gst,

      inclGst:
        req.body.inclGst !== undefined
          ? toNumber(req.body.inclGst)
          : existingQuote.inclGst,

      wallsRoofRate:
        req.body.wallsRoofRate !== undefined
          ? toNumber(req.body.wallsRoofRate)
          : existingQuote.wallsRoofRate,

      floorRate:
        req.body.floorRate !== undefined
          ? toNumber(req.body.floorRate)
          : existingQuote.floorRate,

      ffw:
        req.body.ffw !== undefined
          ? toNumber(req.body.ffw)
          : existingQuote.ffw,

      gfw:
        req.body.gfw !== undefined
          ? toNumber(req.body.gfw)
          : existingQuote.gfw,

      floor:
        req.body.floor !== undefined
          ? toNumber(req.body.floor)
          : existingQuote.floor,

      roof:
        req.body.roof !== undefined
          ? toNumber(req.body.roof)
          : existingQuote.roof,

      additionalCost:
        req.body.additionalCost !== undefined
          ? toNumber(req.body.additionalCost)
          : existingQuote.additionalCost,

      steel:
        req.body.steel !== undefined
          ? toNumber(req.body.steel)
          : existingQuote.steel,

      hasSecondFloor:
        req.body.hasSecondFloor !== undefined
          ? toBoolean(req.body.hasSecondFloor)
          : existingQuote.hasSecondFloor,

      hasHebel:
        req.body.hasHebel !== undefined
          ? toBoolean(req.body.hasHebel)
          : existingQuote.hasHebel,

      hebelHeight:
        req.body.hebelHeight !== undefined
          ? toNumber(req.body.hebelHeight)
          : existingQuote.hebelHeight,

      hebelLength:
        req.body.hebelLength !== undefined
          ? toNumber(req.body.hebelLength)
          : existingQuote.hebelLength,

      hebelRate:
        req.body.hebelRate !== undefined
          ? toNumber(req.body.hebelRate)
          : existingQuote.hebelRate,

      hebelCost:
        req.body.hebelCost !== undefined
          ? toNumber(req.body.hebelCost)
          : existingQuote.hebelCost,

      files: existingQuote.files ?? [],
      updatedAt: new Date().toISOString(),
    };

    db.quotedJobs[jobIndex] = updatedQuote;

    await writeDb(db);

    res.status(200).json(updatedQuote);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to update quote",
    });
  }
});

/**
 * Upload additional PDF to an existing quote
 */
app.post(
  "/api/quoted-jobs/:id/files",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No PDF file was uploaded",
        });
      }

      const db = await readDb();
      const jobId = req.params.id;

      const jobIndex = (db.quotedJobs ?? []).findIndex(
        (job) => job.id === jobId,
      );

      if (jobIndex === -1) {
        await deleteStoredFile(req.file.filename);

        return res.status(404).json({
          message: "Quote not found",
        });
      }

      const fileRecord = createFileRecord(req.file);

      db.quotedJobs[jobIndex] = {
        ...db.quotedJobs[jobIndex],

        files: [
          ...(db.quotedJobs[jobIndex].files ?? []),
          fileRecord,
        ],

        updatedAt: new Date().toISOString(),
      };

      await writeDb(db);

      res.status(201).json(fileRecord);
    } catch (error) {
      console.error(error);

      if (req.file?.filename) {
        await deleteStoredFile(
          req.file.filename,
        ).catch(console.error);
      }

      res.status(500).json({
        message: "Failed to upload PDF",
      });
    }
  },
);

/**
 * Upload several PDFs to an existing quote
 */
app.post(
  "/api/quoted-jobs/:id/files/multiple",
  upload.array("files"),
  async (req, res) => {
    try {
      const uploadedFiles = Array.isArray(req.files)
        ? req.files
        : [];

      if (uploadedFiles.length === 0) {
        return res.status(400).json({
          message: "No PDF files were uploaded",
        });
      }

      const db = await readDb();
      const jobId = req.params.id;

      const jobIndex = (db.quotedJobs ?? []).findIndex(
        (job) => job.id === jobId,
      );

      if (jobIndex === -1) {
        await Promise.all(
          uploadedFiles.map((file) =>
            deleteStoredFile(file.filename),
          ),
        );

        return res.status(404).json({
          message: "Quote not found",
        });
      }

      const fileRecords =
        uploadedFiles.map(createFileRecord);

      db.quotedJobs[jobIndex] = {
        ...db.quotedJobs[jobIndex],

        files: [
          ...(db.quotedJobs[jobIndex].files ?? []),
          ...fileRecords,
        ],

        updatedAt: new Date().toISOString(),
      };

      await writeDb(db);

      res.status(201).json(fileRecords);
    } catch (error) {
      console.error(error);

      if (Array.isArray(req.files)) {
        await Promise.all(
          req.files.map((file) =>
            deleteStoredFile(file.filename).catch(
              console.error,
            ),
          ),
        );
      }

      res.status(500).json({
        message: "Failed to upload PDFs",
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
      const db = await readDb();

      const jobIndex = (
        db.quotedJobs ?? []
      ).findIndex(
        (job) => job.id === req.params.jobId,
      );

      if (jobIndex === -1) {
        return res.status(404).json({
          message: "Quote not found",
        });
      }

      const job = db.quotedJobs[jobIndex];
      const files = job.files ?? [];

      const fileToDelete = files.find(
        (file) => file.id === req.params.fileId,
      );

      if (!fileToDelete) {
        return res.status(404).json({
          message: "File not found",
        });
      }

      db.quotedJobs[jobIndex] = {
        ...job,

        files: files.filter(
          (file) => file.id !== req.params.fileId,
        ),

        updatedAt: new Date().toISOString(),
      };

      await writeDb(db);
      await deleteStoredFile(
        fileToDelete.storedName,
      );

      res.status(200).json({
        message: "File deleted successfully",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to delete file",
      });
    }
  },
);

/**
 * Delete quote and all of its files
 */
app.delete("/api/quoted-jobs/:id", async (req, res) => {
  try {
    const db = await readDb();
    const jobId = req.params.id;

    const quoteToDelete = (
      db.quotedJobs ?? []
    ).find((job) => job.id === jobId);

    if (!quoteToDelete) {
      return res.status(404).json({
        message: "Quote not found",
      });
    }

    db.quotedJobs = db.quotedJobs.filter(
      (job) => job.id !== jobId,
    );

    await writeDb(db);

    if (Array.isArray(quoteToDelete.files)) {
      await Promise.all(
        quoteToDelete.files.map((file) =>
          deleteStoredFile(
            file.storedName,
          ).catch((error) => {
            console.error(
              "Failed to delete attached file:",
              error,
            );
          }),
        ),
      );
    }

    res.status(200).json({
      message: "Quote deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to delete quote",
    });
  }
});

/**
 * Multer and general upload errors
 */
app.use((error, _req, res, _next) => {
  console.error(error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "The PDF must be smaller than 100 MB",
      });
    }

    return res.status(400).json({
      message: error.message,
    });
  }

  if (error instanceof Error) {
    return res.status(400).json({
      message: error.message,
    });
  }

  res.status(500).json({
    message: "Unexpected server error",
  });
});

app.listen(PORT, () => {
  console.log(
    `Backend running on http://localhost:${PORT}`,
  );
});