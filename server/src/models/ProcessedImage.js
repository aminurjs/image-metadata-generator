import mongoose from "mongoose";

const processedImageSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const ProcessedImage = mongoose.model(
  "ProcessedImage",
  processedImageSchema
);
