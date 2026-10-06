import express from "express";
import cors from "cors";
import multer from "multer";
import "dotenv/config";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Replicate from "replicate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  dest: path.join(__dirname, "uploads"),
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

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

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "PhotoMotion.ai server is running"
  });
});

app.get("/api/usage/:userId", (req, res) => {
  const user = getUser(req.params.userId);

  res.json({
    plan: user.plan,
    freeGenerationsRemaining: user.freeGenerations
  });
});

app.post("/api/generate", upload.single("photo"), async (req, res) => {
  let uploadedFile = null;

  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return res.status(503).json({
        error: "AI provider is not configured."
      });
    }

    const userId = req.body.userId || "demo-user";
    const user = getUser(userId);

    if (!req.file) {
      return res.status(400).json({
        error: "Photo is required."
      });
    }

    uploadedFile = req.file.path;

    if (user.plan === "free" && user.freeGenerations <= 0) {
      return res.status(402).json({
        error: "Your 7 free generations are used. Please upgrade."
      });
    }

    let platforms = ["Instagram Reels"];

    if (req.body.platforms) {
      try {
        platforms = JSON.parse(req.body.platforms);
      } catch {
        return res.status(400).json({
          error: "Invalid platforms format."
        });
      }
    }

    const prompt =
      req.body.prompt ||
      "Create smooth cinematic motion from this image with natural movement and a slow camera push-in.";

    const duration =
      String(req.body.duration || "5")
        .replace(/\D/g, "") === "10"
        ? 10
        : 5;

    console.log("Starting Replicate generation...");

    const output = await replicate.run(
      "runwayml/gen4-turbo",
      {
        input: {
          image: fs.createReadStream(uploadedFile),
          prompt,
          duration,
          aspect_ratio: "16:9"
        }
      }
    );

    let videoUrl = null;

    if (output && typeof output.url === "function") {
      videoUrl = output.url();
    } else if (Array.isArray(output) && output[0]) {
      videoUrl =
        typeof output[0].url === "function"
          ? output[0].url()
          : String(output[0]);
    } else if (output) {
      videoUrl = String(output);
    }

    if (!videoUrl) {
      throw new Error("Replicate returned no video URL.");
    }

    const request = {
      id: crypto.randomUUID(),
      status: "completed",
      prompt,
      style: req.body.style || "Cinematic",
      camera: req.body.camera || "Cinematic",
      motion: req.body.motion || "Natural",
      duration: `${duration} seconds`,
      platforms,
      template: req.body.template || null,
      videoUrl,
      createdAt: new Date().toISOString()
    };

    if (user.plan === "free") {
      user.freeGenerations -= 1;
    }

    user.videos.push(request);

    console.log("Video generated successfully.");

    res.json({
      message: "Video generated successfully.",
      video: request,
      videoUrl,
      freeGenerationsRemaining: user.freeGenerations
    });

  } catch (error) {
    console.error("Generation error:", error);

    res.status(500).json({
      error:
        error?.message ||
        "Video generation failed. Please try again."
    });

  } finally {
    if (uploadedFile) {
      try {
        fs.unlinkSync(uploadedFile);
      } catch {
        // Ignore cleanup errors
      }
    }
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

app.listen(PORT, () => {
  console.log(`PhotoMotion.ai running on port ${PORT}`);
});
