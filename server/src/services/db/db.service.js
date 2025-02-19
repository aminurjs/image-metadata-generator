import { ProcessedImage } from "../../models/ProcessedImage.js";

export async function saveImageData(id, data) {
  try {
    const processedImage = new ProcessedImage({
      id,
      data,
    });

    const result = await processedImage.save();
    return result;
  } catch (error) {
    throw new Error(`Database operation failed: ${error.message}`);
  }
}

export async function updateDownloadable(id) {
  try {
    const result = await ProcessedImage.findOneAndUpdate(
      { id },
      { downloadable: false },
      { new: true }
    );

    if (!result) {
      throw new Error("Document not found");
    }

    return result;
  } catch (error) {
    throw new Error(`Database operation failed: ${error.message}`);
  }
}
