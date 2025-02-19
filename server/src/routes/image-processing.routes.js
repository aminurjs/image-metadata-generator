import express from "express";
import multer from "multer";
import { createServer } from "http";
import { Server } from "socket.io";
import { processMultipleImages } from "../controllers/image.controller.js";
import { config } from "../config/base.js";

const router = express.Router();
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

router.post("/", upload.array("images", 10), (req, res) =>
  processMultipleImages(req, res, io)
);

export default router;
