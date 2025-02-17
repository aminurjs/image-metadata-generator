import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "./base.js";

export const apiKey = env.geminiApiKey;
export const genAI = new GoogleGenerativeAI(apiKey);
export const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
export const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};
