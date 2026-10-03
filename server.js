import express from "express";
import cors from "cors";
import multer from "multer";
import "dotenv/config";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { fal } from "@fal-ai/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 15 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const users = new Map();

function getUser(userId) {
  if (!users.has(userId)) {
    users.set(userId, {
      freeGenerations: 7,
      plan: "free",
      videos: []
    });
  }

  return users.get(userId);
}

app.get("/api/usage/:userId", (req, res) => {
  const user = getUser(req.params.userId);

  res.json({
    plan: user.plan,
    freeGenerationsRemaining: user.freeGenerations
  });
});

app.post("/api/generate", upload.single("photo"), async (req, res) => {
  try {
    const userId = req.body.userId || "demo-user";
    const user = getUser(userId);

    if (!req.file) {
      return res.status(400).json({
        error: "Photo is required."
      });
    }

    if (user.plan === "free" && user.freeGenerations <= 0) {
      return res.status(402).json({
        error: "Your 7 free generations are used. Please upgrade."
      });
    }

    if (!process.env.FAL_KEY) {
      return res.status(503).json({
        error: "AI video provider is not configured yet."
      });
    }

    fal.config({
      credentials: process.env.FAL_KEY
    });

    const requestId = crypto.randomUUID();

    // Temporary response until the uploaded photo is connected
    // to public file storage.
    const request = {
      id: requestId,
      status: "ready",
      prompt:
        req.body.prompt ||
        "Create natural cinematic motion from this image.",
      style: req.body.style || "Cinematic",
      camera: req.body.camera || "Cinematic",
      motion: req.body.motion || "Natural",
      duration: req.body.duration || "5 seconds",
      platforms: req.body.platforms
        ? JSON.parse(req.body.platforms)
        : ["Instagram Reels"],
      sourceFile: req.file.filename,
      createdAt: new Date().toISOString()
    };

    user.videos.push(request);

    res.json({
      message: "Backend is ready for AI generation.",
      video: request,
      freeGenerationsRemaining: user.freeGenerations
    });

  } catch (error) {
    console.error("Generation error:", error);

    res.status(500).json({
      error: "Something went wrong while preparing the video."
    });
  }
});

app.get("/api/videos/:userId", (req, res) => {
  const user = getUser(req.params.userId);

  res.json({
    videos: user.videos
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(process.env.PORT || 3000, () => {
  console.log(
    `PhotoMotion.ai running on port ${process.env.PORT || 3000}`
  );
});
