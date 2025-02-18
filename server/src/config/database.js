import mongoose from "mongoose";
import { config } from "./base.js";

export async function connectDB() {
  try {
    await mongoose.connect(config.db_uri);
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}
