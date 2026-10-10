import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import {
  disconnectAdminGmail,
  finishGmailConnection,
  getAdminEmailStatus,
  startGmailConnection
} from "../controllers/admin-email.controller.js";

const router = Router();

// Google redirects here after consent; signed OAuth state validates the request.
router.get("/email/gmail/callback", finishGmailConnection);

router.use(authenticateToken, requireAdmin);
router.get("/email/status", getAdminEmailStatus);
router.get("/email/gmail/connect", startGmailConnection);
router.delete("/email/gmail", disconnectAdminGmail);

export default router;
