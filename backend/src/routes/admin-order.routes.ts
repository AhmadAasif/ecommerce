import { Router } from "express";
import {
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
  refundAdminOrder
} from "../controllers/admin-order.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

router.get("/orders", getAdminOrders);
router.get("/orders/:id", getAdminOrderById);
router.put("/orders/:id/status", updateAdminOrderStatus);
router.post("/orders/:id/refund", refundAdminOrder);

export default router;
