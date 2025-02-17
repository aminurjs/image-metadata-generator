import path from "path";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { apiKey, model, generationConfig } from "../../config/gemini.config.js";
import { safetySettings } from "../../config/safety.settings.js";
import { addImageMetadata } from "../metadata/injector.service.js";
import {
  BASE_PROMPT,
  FORBIDDEN_KEYWORDS,
  PROMPT,
} from "../../constants/image.constants.js";

const fileManager = new GoogleAIFileManager(apiKey);

async function uploadToGemini(filePath, mimeType) {
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName: path.basename(filePath),
  });
  return uploadResult.file;
}

export async function generate(filePath, type, outputPath) {
  try {
    const file = await uploadToGemini(filePath, `image/${type}`);
    const chatSession = model.startChat({
      generationConfig,
      safetySettings,
      history: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                mimeType: file.mimeType,
                fileUri: file.uri,
              },
            },
            { text: BASE_PROMPT },
          ],
        },
      ],
    });

    const forbiddenKeywordsStr = FORBIDDEN_KEYWORDS.join(", ");
    const dataResult = await chatSession.sendMessage(
      `${PROMPT}: ${forbiddenKeywordsStr}`
    );
    const jsonResponse = dataResult.response.text();
    const cleanedResponse = jsonResponse
      .replace(/^```json/, "")
      .replace(/```$/, "")
      .trim();
    const parsedJson = JSON.parse(cleanedResponse);

    try {
      const result = await addImageMetadata(filePath, parsedJson, outputPath);
      return result;
    } catch (metadataError) {
      throw new Error(`Failed to add metadata: ${metadataError.message}`);
    }
  } catch (error) {
    throw new Error(`Error processing SEO metadata: ${error.message}`);
  }
}
