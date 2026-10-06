import { Router } from "express";
import { getInventory, updateInventory } from "../controllers/admin-inventory.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

const router = Router();
router.use(authenticateToken, requireAdmin);
router.get("/inventory", getInventory);
router.put("/inventory/:variantId", updateInventory);
export default router;
