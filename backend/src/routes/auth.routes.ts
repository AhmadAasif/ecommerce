import { Router } from "express";
import { adminLogin } from "../controllers/auth.controller.js";
import { setupFirstAdmin } from "../controllers/admin-setup.controller.js";
import { validateBody } from "../middleware/validation.middleware.js";

const router = Router();

router.post(
  "/admin/setup",
  validateBody([
    { field: "setupSecret", type: "string", required: true, minLength: 32 },
    { field: "name", type: "string", required: true, minLength: 2 },
    { field: "email", type: "email", required: true },
    { field: "password", type: "string", required: true, minLength: 12 }
  ]),
  setupFirstAdmin
);

router.post(
  "/admin/login",
  validateBody([
    { field: "email", type: "email", required: true },
    { field: "password", type: "string", required: true, minLength: 8 }
  ]),
  adminLogin
);

export default router;
