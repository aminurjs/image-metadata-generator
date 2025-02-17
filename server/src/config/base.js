import { config } from "dotenv";

config();

export const env = {
  geminiApiKey: process.env.GEMINI_API_KEY,
  db_uri: process.env.MONGODB_URI,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};
