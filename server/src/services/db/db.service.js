import { ProcessedImage } from "../../models/ProcessedImage.js";

export async function saveImageData({ imageUrl, metadata }) {
  try {
    const processedImage = new ProcessedImage({
      imageUrl,
      metadata,
    });

    const result = await processedImage.save();
    return result;
  } catch (error) {
    throw new Error(`Database operation failed: ${error.message}`);
  }
}
