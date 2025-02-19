import express from "express";
import multer from "multer";
import { fileURLToPath } from "url";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import {
  clearProcessedDirectory,
  processMultipleImages,
} from "./controllers/image.controller.js";
import { connectDB } from "./config/database.js";
import cors from "cors";
import { config } from "./config/base.js";
import imageRoute from "./routes/image.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
connectDB();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    credentials: true,
  },
});

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/original/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

app.use(express.json());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Change to handle multiple images
app.post("/api/process-images", upload.array("images", 10), (req, res) =>
  processMultipleImages(req, res, io)
);

app.use("/api/images", imageRoute);

app.use(
  "/processed",
  express.static(path.join(__dirname, "../public/processed"))
);

const PORT = config.port;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

clearProcessedDirectory();
