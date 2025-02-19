import { Router } from "express";
import { updateImage } from "../controllers/image-update.controller.js";
import { downloadProcessedImages } from "../controllers/image.controller.js";

const router = Router();

router.get("/download/:requestId", downloadProcessedImages);

router.patch("/update", updateImage);

export default router;
