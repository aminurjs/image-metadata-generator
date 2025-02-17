import { ExiftoolProcess } from "node-exiftool";
import exiftoolBin from "dist-exiftool";
import fs from "fs/promises";
import path from "path";

// Create a new ExifTool process
const ep = new ExiftoolProcess(exiftoolBin);

/**
 * Adds or updates metadata for various image formats using ExifTool
 * @param {string} imagePath - Path to the image file
 * @param {Object} metadata - Metadata to be added
 * @returns {Promise<Object>} - Object containing status and output path
 */
async function addImageMetadata(imagePath, metadata) {
  try {
    if (!imagePath || !metadata) {
      throw new Error("Image path and metadata are required");
    }

    // Check if file exists
    await fs.access(imagePath);

    // Get file extension
    const ext = path.extname(imagePath).toLowerCase();

    if (!ext) {
      throw new Error(`File has no extension: ${imagePath}`);
    }

    const supportedFormats = [".jpg", ".jpeg", ".png", ".webp", ".tiff"];
    if (!supportedFormats.includes(ext)) {
      throw new Error(`Unsupported image format: ${ext}`);
    }

    const outputDir = path.join(path.dirname(imagePath), "succeed");
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, path.basename(imagePath));

    // Copy original file to output location
    await fs.copyFile(imagePath, outputPath);

    // Start ExifTool process
    await ep.open();

    // Prepare metadata based on format
    const metadataToWrite = prepareMetadata(metadata, ext);

    // Write metadata using ExifTool
    await ep.writeMetadata(outputPath, metadataToWrite, ["overwrite_original"]);

    // For PNG, do a second pass specifically for keywords
    if (ext === ".png" && metadata.keywords && metadata.keywords.length > 0) {
      // Write keywords separately
      await ep.writeMetadata(
        outputPath,
        {
          Keywords: metadata.keywords,
          "XMP:Subject": metadata.keywords,
          "XMP-dc:Subject": metadata.keywords,
          "PNG:Keywords": metadata.keywords.join(";"),
        },
        ["overwrite_original"]
      );
    }

    // Verify metadata was written
    const verifyMetadata = await ep.readMetadata(outputPath);

    // Close ExifTool process
    await ep.close();

    if (
      !verifyMetadata ||
      !verifyMetadata.data ||
      verifyMetadata.data.length === 0
    ) {
      throw new Error("Metadata verification failed");
    }

    return {
      status: "success",
      message: "Metadata added successfully",
      outputPath,
      verifiedMetadata: verifyMetadata.data[0],
    };
  } catch (error) {
    // Make sure to close ExifTool process even if there's an error
    await ep.close();
    throw new Error(`Failed to add metadata: ${error.message}`);
  }
}

/**
 * Prepare metadata based on format
 * @private
 */
function prepareMetadata(metadata, format) {
  switch (format) {
    case ".jpg":
    case ".jpeg":
      return {
        "IPTC:ObjectName": metadata.title,
        "IPTC:Caption-Abstract": metadata.description,
        "IPTC:Keywords": metadata.keywords,
        "XMP:Title": metadata.title,
        "XMP:Description": metadata.description,
        "XMP:Subject": metadata.keywords,
        "EXIF:ImageDescription": metadata.description,
        "EXIF:XPTitle": metadata.title,
        "EXIF:XPKeywords": metadata.keywords
          ? metadata.keywords.join(";")
          : undefined,
      };

    case ".png":
      return {
        // Title and Description
        "PNG:Title": metadata.title,
        "PNG:Description": metadata.description,
        "XMP:Title": metadata.title,
        "XMP:Description": metadata.description,
        Description: metadata.description,

        // Multiple keyword formats
        "XMP:Subject": metadata.keywords,
        "XMP-dc:Subject": metadata.keywords,
        Keywords: metadata.keywords,
        "PNG:Keywords": metadata.keywords
          ? metadata.keywords.map((k) => k.trim()).join(";")
          : undefined,
        "PNG-iTXt:Keywords": metadata.keywords
          ? metadata.keywords.map((k) => k.trim()).join(";")
          : undefined,
      };

    case ".webp":
      return {
        "XMP:Title": metadata.title,
        "XMP:Description": metadata.description,
        "XMP:Subject": metadata.keywords,
      };

    case ".tiff":
      return {
        "TIFF:ImageDescription": metadata.description,
        "TIFF:DocumentName": metadata.title,
        "XMP:Title": metadata.title,
        "XMP:Description": metadata.description,
        "XMP:Subject": metadata.keywords,
      };

    default:
      return {
        Title: metadata.title,
        Description: metadata.description,
        Keywords: metadata.keywords,
      };
  }
}

export default addImageMetadata;
