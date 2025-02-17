import { generate } from "../services/ai/gemini.service.js";
import { uploadToCloudinary } from "../services/cloudinary/cloudinary.service.js";
import { saveImageData } from "../services/db/db.service.js";
import fs from "fs/promises";
import path from "path";

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

async function cleanupFiles(filePaths) {
  for (const filePath of filePaths) {
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error(`Failed to delete file ${filePath}:`, error);
      }
    }
  }
}
