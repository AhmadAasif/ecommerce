import { Router } from "express";
import { createProduct, updateProduct, deleteProduct } from "../controllers/admin-product.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

const router = Router();
router.use(authenticateToken);
router.use(requireAdmin);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);
export default router;