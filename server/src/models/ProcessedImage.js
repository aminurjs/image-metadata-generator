import mongoose from "mongoose";

const processedImageSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    downloadable: {
      type: Boolean,
      required: true,
      default: true,
    },
    data: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          auto: true,
        },
        filename: {
          type: String,
          required: true,
        },
        imageUrl: {
          type: String,
          required: true,
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const ProcessedImage = mongoose.model(
  "ProcessedImage",
  processedImageSchema
);
