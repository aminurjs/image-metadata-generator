require("dotenv").config();
const generate = require("./gemini.metadata.generator");
const fs = require("fs");
const path = require("path");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let loadingInterval;

// Function to show loading animation at the bottom
function startLoading() {
  const frames = ["|", "/", "-", "\\"];
  let i = 0;
  process.stdout.write("\n");
  loadingInterval = setInterval(() => {
    process.stdout.write(`\rProcessing files... ${frames[i++]}`);
    if (i >= frames.length) i = 0;
  }, 200);
}

function stopLoading() {
  clearInterval(loadingInterval);
  process.stdout.write("\rProcessing completed!\n\n");
}

// Function to process valid files
async function processFile(filePath, ext, index, file) {
  try {
    await generate(filePath, ext);
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
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
  startLoading();
  await getAllFilePaths(folderPath);
  stopLoading();
  process.exit(0);
})();
