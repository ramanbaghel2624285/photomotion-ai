import express from "express";
import cors from "cors";
import multer from "multer";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fal } from "@fal-ai/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 15 * 1024 * 1024
  }
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
  let uploadedFile = null;

  try {
    const userId = req.body.userId || "demo-user";
    const user = getUser(userId);

    if (!req.file) {
      return res.status(400).json({
        error: "Please upload a photo."
      });
    }

    uploadedFile = req.file.path;

    if (user.plan === "free" && user.freeGenerations <= 0) {
      return res.status(402).json({
        error: "Your 7 free generations are used."
      });
    }

    if (!process.env.FAL_KEY) {
      return res.status(503).json({
        error: "AI provider is not configured yet."
      });
    }

    fal.config({
      credentials: process.env.FAL_KEY
    });

    const imageBuffer = fs.readFileSync(uploadedFile);

    const imageBase64 = imageBuffer.toString("base64");

    const mimeType = req.file.mimetype || "image/jpeg";

    const imageDataUri =
      `data:${mimeType};base64,${imageBase64}`;

    const style = req.body.style || "Cinematic";
    const camera = req.body.camera || "Cinematic";
    const motion = req.body.motion || "Natural";

    const prompt =
      req.body.prompt ||
      `Create a ${style} image-to-video animation. ` +
      `Use ${camera} camera movement with ${motion} motion. ` +
      `Keep the main subject natural and visually consistent.`;

    const result = await fal.subscribe(
      "fal-ai/vidu/image-to-video",
      {
        input: {
          prompt: prompt.slice(0, 1500),
          image_url: imageDataUri,
          movement_amplitude:
            motion === "Strong"
              ? "large"
              : motion === "Dynamic"
              ? "medium"
              : motion === "Subtle"
              ? "small"
              : "auto"
        },
        logs: true
      }
    );

    const videoUrl = result?.data?.video?.url;

    if (!videoUrl) {
      throw new Error("AI provider did not return a video URL.");
    }

    user.freeGenerations--;

    const video = {
      id: Date.now().toString(),
      status: "completed",
      videoUrl,
      prompt,
      style,
      camera,
      motion,
      createdAt: new Date().toISOString()
    };

    user.videos.unshift(video);

    res.json({
      success: true,
      video,
      freeGenerationsRemaining: user.freeGenerations
    });

  } catch (error) {
    console.error("Generation error:", error);

    res.status(500).json({
      error:
        error?.message ||
        "Video generation failed."
    });

  } finally {
    if (uploadedFile) {
      try {
        fs.unlinkSync(uploadedFile);
      } catch {}
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
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

app.listen(process.env.PORT || 3000, () => {
  console.log(
    `PhotoMotion.ai running on port ${process.env.PORT || 3000}`
  );
});
