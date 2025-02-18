import { generate } from "../services/ai/gemini.service.js";
import { uploadToCloudinary } from "../services/cloudinary/cloudinary.service.js";
import { saveImageData } from "../services/db/db.service.js";
import { cleanupFiles } from "../utils/file.utils.js";
import fs from "fs/promises";
import path from "path";
import { processOneImage } from "../services/image/image-processing.service.js";
import {
  emitProcessComplete,
  emitProcessError,
  emitProcessProgress,
  emitProcessStart,
} from "../services/socket/socket.service.js";

const PROCESSED_DIR = "public/uploads/processed";

export async function processImageAndUpload(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided" });
  }

  const tempOutputDir = path.join("uploads", "processed");
  let processedFilePath = null;

  try {
    // Create temp output directory if it doesn't exist
    await fs.mkdir(tempOutputDir, { recursive: true });

    const fileExtension = path
      .extname(req.file.originalname)
      .toLowerCase()
      .slice(1);

    // Process the image with AI and add metadata
    const generateResult = await generate(
      req.file.path,
      fileExtension,
      tempOutputDir
    );

    processedFilePath = generateResult.outputPath;

    // Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(processedFilePath);

    // Save to database
    const dbResult = await saveImageData({
      imageUrl: cloudinaryResult.secure_url,
      metadata: generateResult.metadata,
    });

    // Clean up temporary files
    await cleanupFiles([req.file.path, processedFilePath]);

    res.json({
      success: true,
      data: {
        id: dbResult.id,
        imageUrl: dbResult.imageUrl,
        metadata: dbResult.metadata,
      },
    });
  } catch (error) {
    // Cleanup any files if they exist
    await cleanupFiles([req.file.path, processedFilePath]);

    res.status(500).json({
      error: "Failed to process image",
      message: error.message,
    });
  }
}

export async function processMultipleImages(req, res, io) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No images provided" });
  }

  try {
    // Create processed directory if it doesn't exist
    await fs.mkdir(PROCESSED_DIR, { recursive: true });

    const results = [];
    let completedCount = 0;
    const totalImages = req.files.length;

    // Send initial status to all clients
    emitProcessStart(io, totalImages);

    // Process each image
    for (const file of req.files) {
      try {
        const result = await processOneImage(file, PROCESSED_DIR);
        results.push(result);
        completedCount++;

        // Emit progress update to all clients
        emitProcessProgress(io, completedCount, totalImages, result);
      } catch (error) {
        // Emit error for this specific image
        emitProcessError(io, file.originalname, error.message);
      }
    }

    // Emit completion message to all clients
    emitProcessComplete(io, results);
    await saveImageData(results);
    // Send response to the original request
    res.json({
      success: true,
      message: "Processing started",
      totalImages,
    });
  } catch (error) {
    io.emit("processError", {
      status: "error",
      error: error.message,
    });

    res.status(500).json({
      error: "Failed to process images",
      message: error.message,
    });
  }
}
