import { ExiftoolProcess } from "node-exiftool";
import exiftoolBin from "dist-exiftool";
import fs from "fs/promises";
import path from "path";
import { prepareMetadata } from "./exif.utils.js";
import { SUPPORTED_FORMATS } from "../../constants/image.constants.js";

const ep = new ExiftoolProcess(exiftoolBin);

export async function addImageMetadata(imagePath, metadata) {
  try {
    if (!imagePath || !metadata) {
      throw new Error("Image path and metadata are required");
    }

    await fs.access(imagePath);
    const ext = path.extname(imagePath).toLowerCase();

    if (!ext) {
      throw new Error(`File has no extension: ${imagePath}`);
    }

    if (!SUPPORTED_FORMATS.includes(ext)) {
      throw new Error(`Unsupported image format: ${ext}`);
    }

    const outputDir = path.join(path.dirname(imagePath), "succeed");
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, path.basename(imagePath));
    await fs.copyFile(imagePath, outputPath);

    await ep.open();
    const metadataToWrite = prepareMetadata(metadata, ext);
    await ep.writeMetadata(outputPath, metadataToWrite, ["overwrite_original"]);

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
