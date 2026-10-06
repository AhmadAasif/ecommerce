import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

const router = Router();
router.get("/test", authenticateToken, requireAdmin, (_req, res) => {
  res.json({ success:true, message:"Admin authentication is working!" });
});
export default router;