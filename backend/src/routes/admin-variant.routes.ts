import { Router } from "express";
import { createVariant, updateVariant, deleteVariant } from "../controllers/admin-variant.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

const router = Router();
router.use(authenticateToken);
router.use(requireAdmin);
router.post("/products/:productId/variants", createVariant);
router.put("/variants/:variantId", updateVariant);
router.delete("/variants/:variantId", deleteVariant);
export default router;