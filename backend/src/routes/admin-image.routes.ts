import { Router } from "express";
import { uploadProductImage } from "../controllers/admin-image.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import upload from "../middleware/upload.middleware.js";

const router = Router();
router.use(authenticateToken);
router.use(requireAdmin);
router.post("/products/:productId/images", upload.single("image"), uploadProductImage);
export default router;