import {
  saveImageData,
  updateDownloadable,
} from "../services/db/db.service.js";
import fs from "fs/promises";
import fsSync from "fs";
import archiver from "archiver";
import { processOneImage } from "../services/image/image-processing.service.js";
import {
  emitProcessComplete,
  emitProcessError,
  emitProcessProgress,
  emitProcessStart,
} from "../services/socket/socket.service.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const PROCESSED_DIR = "public/processed";

export async function processMultipleImages(req, res, io) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No images provided" });
  }

  try {
    // Create a unique directory for each request
    const requestId = uuidv4();
    const requestDir = path.join(PROCESSED_DIR, requestId);
    await fs.mkdir(requestDir, { recursive: true });

    const results = [];
    let completedCount = 0;
    const totalImages = req.files.length;

    // Send initial status to all clients
    emitProcessStart(io, totalImages);

    // Process each image
    for (const file of req.files) {
      try {
        const result = await processOneImage(file, requestDir, requestId);
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
    const dbResult = await saveImageData(requestId, results);

    emitProcessComplete(io, dbResult);

    // Schedule directory deletion after 10 minutes (600,000 ms)
    setTimeout(async () => {
      try {
        await fs.rm(requestDir, { recursive: true, force: true });
        await updateDownloadable(requestId);
        console.log(`Deleted directory: ${requestDir}`);
      } catch (deleteError) {
        console.error(
          `Error deleting directory ${requestDir}:`,
          deleteError.message
        );
      }
    }, 10 * 60 * 1000); // 10 minutes

    // Send response to the original request
    res.json({
      success: true,
      message: "Processing started",
      totalImages,
      requestId, // Send back the request ID for reference
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

export async function downloadProcessedImages(req, res) {
  const { requestId } = req.params;
  const requestDir = path.join(PROCESSED_DIR, requestId);
  const zipPath = path.join(PROCESSED_DIR, `${requestId}.zip`);

  try {
    // Check if directory exists
    const dirExists = await fs
      .access(requestDir)
      .then(() => true)
      .catch(() => false);

    if (!dirExists) {
      return res.status(404).json({ error: "Directory not found or expired" });
    }

    // Create a ZIP archive
    const output = fsSync.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(requestDir, false);

    // Ensure ZIP file is finalized before proceeding
    await archive.finalize();

    output.on("close", async () => {
      res.download(zipPath, `${requestId}.zip`, async (err) => {
        if (err) {
          console.error("Error sending ZIP file:", err.message);
          return res.status(500).json({ error: "Failed to send ZIP file" });
        }
        // Optionally delete the ZIP file after download
        try {
          await fs.rm(zipPath, { force: true });
        } catch (rmError) {
          console.error("Error deleting ZIP file:", rmError.message);
        }
      });
    });

    output.on("error", async (err) => {
      console.error("Error creating ZIP file:", err.message);
      await fs.rm(zipPath, { force: true });
      res.status(500).json({ error: "Failed to create ZIP" });
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
}

export async function clearProcessedDirectory() {
  try {
    // Ensure processed directory exists
    await fs
      .access(PROCESSED_DIR)
      .catch(() => fs.mkdir(PROCESSED_DIR, { recursive: true }));

    // Read all folders inside the processed directory
    const folders = await fs.readdir(PROCESSED_DIR);

    if (folders.length === 0) {
      console.log("No existing processed folders to clean up.");
      return;
    }

    console.log(
      `Found ${folders.length} processed folders. Updating database...`
    );

    // Delete all folders after updating DB
    for (const folder of folders) {
      const folderPath = path.join(PROCESSED_DIR, folder);
      await fs.rm(folderPath, { recursive: true, force: true });
      await updateDownloadable(folder);
      console.log(`Deleted folder: ${folderPath}`);
    }

    console.log(
      "Database updated and processed directory cleaned up successfully."
    );
  } catch (error) {
    console.error("Error processing and clearing folders:", error.message);
  }
}
