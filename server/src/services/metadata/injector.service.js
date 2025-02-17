import { ExiftoolProcess } from "node-exiftool";
import exiftoolBin from "dist-exiftool";
import fs from "fs/promises";
import path from "path";
import { prepareMetadata } from "./exif.utils.js";
import { SUPPORTED_FORMATS } from "../../constants/image.constants.js";

const ep = new ExiftoolProcess(exiftoolBin);

export async function addImageMetadata(imagePath, metadata, outputDir) {
  try {
    if (!imagePath || !metadata || !outputDir) {
      throw new Error(
        "Image path, metadata, and output directory are required"
      );
    }

    // Verify input file exists
    await fs.access(imagePath);

    // Validate file extension
    const ext = path.extname(imagePath).toLowerCase();
    if (!ext) {
      throw new Error(`File has no extension: ${imagePath}`);
    }
    if (!SUPPORTED_FORMATS.includes(ext)) {
      throw new Error(`Unsupported image format: ${ext}`);
    }

    // Get the original filename and construct the full output path
    const originalFilename = path.basename(imagePath);
    const outputPath = path.join(outputDir, originalFilename);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Copy input file to output location
    await fs.copyFile(imagePath, outputPath);

    // Open exiftool process
    await ep.open();

    // Write main metadata
    const metadataToWrite = prepareMetadata(metadata, ext);
    await ep.writeMetadata(outputPath, metadataToWrite, ["overwrite_original"]);

    // Special handling for PNG keywords
    if (ext === ".png" && metadata.keywords && metadata.keywords.length > 0) {
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

    // Verify metadata was written successfully
    const verifyMetadata = await ep.readMetadata(outputPath);
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
    await ep.close();
    throw new Error(`Failed to add metadata: ${error.message}`);
  }
}
