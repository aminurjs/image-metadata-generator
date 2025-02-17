import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file || !req.body.newName) {
    return res.status(400).json({ error: "Missing file or new name" });
  }

  // Ensure unique filename using timestamp
  const timestamp = Date.now();
  const ext = path.extname(req.file.originalname);
  const newFileName = `${req.body.newName.replace(
    /\s+/g,
    "_"
  )}_${timestamp}${ext}`;
  const newPath = path.join("uploads", newFileName);

  fs.rename(req.file.path, newPath, (err) => {
    if (err) return res.status(500).json({ error: "File rename failed" });

    const imageUrl = `http://localhost:5000/uploads/${newFileName}`;

    res.json({ imageUrl });

    // Set timeout to delete the file after 1 minute (to ensure it's available)
    setTimeout(() => {
      fs.unlink(newPath, (err) => {
        if (err) console.error("Failed to delete file:", err);
      });
    }, 60000); // 60 seconds
  });
});

// Serve images statically
app.use("/uploads", express.static("uploads"));

app.listen(5000, () => console.log("Server running on port 5000"));
