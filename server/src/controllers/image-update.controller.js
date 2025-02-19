import path from "path";
import { updateImageMetadata } from "../services/metadata/injector.service.js";
import { PROCESSED_DIR } from "./image.controller.js";
import { ProcessedImage } from "../models/ProcessedImage.js";
export const updateImage = async (req, res) => {
  const { imagePath, _id, updateData } = req.body;

  const requestDir = path.join(
    PROCESSED_DIR,
    imagePath.replace(/^\/processed\//, "")
  );
  try {
    await updateImageMetadata(requestDir, updateData);

    const updateQuery = {};
    for (const key in updateData) {
      updateQuery[`data.$.metadata.${key}`] = updateData[key];
    }

    const updatedImage = await ProcessedImage.findOneAndUpdate(
      { "data._id": _id },
      { $set: updateQuery },
      { new: true }
    );

    if (!updatedImage) {
      return res
        .status(404)
        .json({ success: false, message: "Image not found" });
    }

    res.status(200).json({ success: true, updatedFields: updateData });
  } catch (error) {
    console.error("Error updating image:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
