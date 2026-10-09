import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import {
  changeAdminPassword,
  createAdminAccount,
  getAdminAccount,
  updateAdminAccount
} from "../controllers/admin-account.controller.js";

const router = Router();

router.get("/test", authenticateToken, requireAdmin, (_req, res) => {
  res.json({ success: true, message: "Admin authentication is working!" });
});

router.get("/account", authenticateToken, requireAdmin, getAdminAccount);
router.patch("/account", authenticateToken, requireAdmin, updateAdminAccount);
router.patch("/account/password", authenticateToken, requireAdmin, changeAdminPassword);
router.post("/accounts", authenticateToken, requireAdmin, createAdminAccount);

export default router;
