const path = require("path");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const addImageMetadata = require("./metadata.injector");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

async function uploadToGemini(filePath, mimeType) {
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName: path.basename(filePath),
  });
  return uploadResult.file;
}

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

const generate = async (path, type) => {
  try {
    const file = await uploadToGemini(path, `image/${type}`);
    const prompt = `Generate SEO friendly title, description, and keywords(single word) as a JSON object for the following image. Only return the JSON. Do not include any other text.
      {
        "title": "generated title",
        "description": "generated description",
        "keywords": ["keyword1", "keyword2", ...]
      }
    `;

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
            { text: prompt },
          ],
        },
      ],
    });

    const result = await chatSession.sendMessage(
      `Please give me a long perfect title of about 90 characters, description of about 120 characters and as realeted 45 single SEO keywords based on the Microstock site and follow (Anatomy of Titles: Style, Subject, Location or background) about this image, dont use (:, |) symbols in title and description;

Haram in Islam Do not use these keywords in any titles, descriptions, and keywords such as "thanksgiving, valentine, vintage, heaven, heavenly, retro, god, love, valentines, day, paradise, majestic, magic, rejuvenating, habitat, pristine, revival, residence, primitive, zen, graceful, fashion, cinema, movie, club, bar, matrix, nightlife, fantasy, sci-fi, romantic, wedding, party, Christmas, celebration, easter, winery, wine, spooky, majestic, pork, kaleidoscopic, mandala, bohemian, ethnic, folk, fairy tale, story, celestial, minimalistic, and others.`
    );

    const jsonResponse = result.response.text();
    const cleanedResponse = jsonResponse
      .replace(/^```json/, "")
      .replace(/```$/, "")
      .trim();
    const parsedJson = JSON.parse(cleanedResponse);

    const meteResult = await addImageMetadata(path, parsedJson);

    return "SEO metadata successfully generated and added.";
  } catch (error) {
    throw new Error(`Error processing SEO metadata: ${error.message}`);
  }
};

module.exports = generate;
