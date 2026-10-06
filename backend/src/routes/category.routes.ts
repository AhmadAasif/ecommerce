import { Router } from "express";
import { getCategories } from "../controllers/category.controller.js";
import { createCategory, updateCategory, deleteCategory } from "../controllers/admin-category.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

const router = Router();

router.get("/", getCategories);
router.post("/", authenticateToken, requireAdmin, createCategory);
router.put("/:id", authenticateToken, requireAdmin, updateCategory);
router.delete("/:id", authenticateToken, requireAdmin, deleteCategory);

export default router;
