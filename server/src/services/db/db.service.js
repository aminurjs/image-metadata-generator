import { ProcessedImage } from "../../models/ProcessedImage.js";

export async function saveImageData(data) {
  try {
    const processedImage = new ProcessedImage({
      data,
    });

    const result = await processedImage.save();
    return result;
  } catch (error) {
    throw new Error(`Database operation failed: ${error.message}`);
  }
}
