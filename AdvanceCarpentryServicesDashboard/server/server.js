import express from "express";
import cors from "cors";
import multer from "multer";
import { promises as fs } from "fs";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

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
  destination: function (req, file, cb) {
    cb(null, uploadsPath);
  },
  filename: function (req, file, cb) {
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${Date.now()}-${randomUUID()}-${safeOriginalName}`;

    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

async function readDb() {
  const file = await fs.readFile(dbPath, "utf-8");
  return JSON.parse(file);
}

async function writeDb(data) {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  return Number(value);
}

app.get("/api/quoted-jobs", async (req, res) => {
  try {
    const db = await readDb();
    res.json(db.quotedJobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load quoted jobs" });
  }
});

app.get("/api/quoted-jobs/:id", async (req, res) => {
  try {
    const db = await readDb();
    const jobId = req.params.id;

    const job = db.quotedJobs.find((job) => job.id === jobId);

    if (!job) {
      return res.status(404).json({ message: "Quote not found" });
    }

    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load quote" });
  }
});

app.post("/api/quoted-jobs", upload.array("files"), async (req, res) => {
  try {
    const db = await readDb();

    const uploadedFiles = (req.files ?? []).map((file) => ({
      id: randomUUID(),
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      path: `/uploads/${file.filename}`,
      uploadedAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }));

    const newQuote = {
      id: randomUUID(),
      name: req.body.name,
      quotedAmount: toNumber(req.body.quotedAmount),
      gst: toNumber(req.body.gst),
      inclGst: toNumber(req.body.inclGst),
      address: req.body.address,
      wallsRoofRate: toNumber(req.body.wallsRoofRate),
      floorRate: toNumber(req.body.floorRate),
      ffw: toNumber(req.body.ffw),
      gfw: toNumber(req.body.gfw),
      floor: toNumber(req.body.floor),
      roof: toNumber(req.body.roof),
      additionalCost: toNumber(req.body.additionalCost),
      steel: toNumber(req.body.steel),
      files: uploadedFiles,
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    db.quotedJobs.unshift(newQuote);

    await writeDb(db);

    res.status(201).json(newQuote);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create quote" });
  }
});

app.patch("/api/quoted-jobs/:id", async (req, res) => {
  try {
    const db = await readDb();
    const jobId = req.params.id;

    const jobIndex = db.quotedJobs.findIndex((job) => job.id === jobId);

    if (jobIndex === -1) {
      return res.status(404).json({ message: "Quote not found" });
    }

    const existingQuote = db.quotedJobs[jobIndex];

    const updatedQuote = {
      ...existingQuote,

      name: req.body.name ?? existingQuote.name,
      address: req.body.address ?? existingQuote.address,

      quotedAmount: toNumber(req.body.quotedAmount),
      gst: toNumber(req.body.gst),
      inclGst: toNumber(req.body.inclGst),

      wallsRoofRate: toNumber(req.body.wallsRoofRate),
      floorRate: toNumber(req.body.floorRate),
      ffw: toNumber(req.body.ffw),
      gfw: toNumber(req.body.gfw),
      floor: toNumber(req.body.floor),
      roof: toNumber(req.body.roof),
      additionalCost: toNumber(req.body.additionalCost),
      steel: toNumber(req.body.steel),

      updatedAt: new Date().toISOString(),
    };

    db.quotedJobs[jobIndex] = updatedQuote;

    await writeDb(db);

    res.status(200).json(updatedQuote);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update quote" });
  }
});

app.delete("/api/quoted-jobs/:id", async (req, res) => {
  try {
    const db = await readDb();
    const jobId = req.params.id;

    const quoteToDelete = db.quotedJobs.find((job) => job.id === jobId);

    if (!quoteToDelete) {
      return res.status(404).json({ message: "Quote not found" });
    }

    if (Array.isArray(quoteToDelete.files)) {
      for (const file of quoteToDelete.files) {
        try {
          const filePath = path.join(uploadsPath, file.storedName);
          await fs.unlink(filePath);
        } catch (fileError) {
          console.error("Failed to delete attached file:", fileError);
        }
      }
    }

    db.quotedJobs = db.quotedJobs.filter((job) => job.id !== jobId);

    await writeDb(db);

    res.status(200).json({ message: "Quote deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete quote" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});