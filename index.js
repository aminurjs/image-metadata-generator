require("dotenv").config();
const generate = require("./gemini.metadata.generator");
const fs = require("fs");
const path = require("path");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to process valid files
async function processFile(filePath, ext, index, file) {
  try {
    await generate(filePath, ext);
    console.log(`\x1b[32m%s\x1b[0m`, `${index + 1}. ${file} Success`);
  } catch (error) {
    console.error(error);
  }
}

async function getAllFilePaths(dir) {
  const files = fs.readdirSync(dir);
  const allowedExtensions = ["jpg", "jpeg", "png", "webp"];

  let index = 0;
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      await getAllFilePaths(filePath);
    } else {
      const ext = path.extname(file).toLowerCase().slice(1);
      if (allowedExtensions.includes(ext)) {
        await processFile(filePath, ext, index, file);
        index++;
        await delay(1000);
      }
    }
  }
}

// Usage
(async () => {
  const folderPath = "D:\\Freepik\\Assets\\Calligraphy";
  await getAllFilePaths(folderPath);
})();
