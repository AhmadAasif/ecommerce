import { Router } from "express";
import { adminLogin } from "../controllers/auth.controller.js";
import { validateBody } from "../middleware/validation.middleware.js";

const router = Router();

router.post(
  "/admin/login",
  validateBody([
    { field: "email", type: "email", required: true },
    { field: "password", type: "string", required: true, minLength: 8 }
  ]),
  adminLogin
);

export default router;
