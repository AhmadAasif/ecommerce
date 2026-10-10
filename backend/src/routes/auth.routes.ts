import { Router } from "express";
import { adminLogin } from "../controllers/auth.controller.js";
import { setupFirstAdmin } from "../controllers/admin-setup.controller.js";
import { registerCustomer, loginCustomer, googleCustomerLogin, getCustomerProfile, getCustomerOrders } from "../controllers/customer-auth.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";

const router = Router();

router.post("/admin/setup", validateBody([
  { field: "setupSecret", type: "string", required: true, minLength: 32 },
  { field: "name", type: "string", required: true, minLength: 2 },
  { field: "email", type: "email", required: true },
  { field: "password", type: "string", required: true, minLength: 12 }
]), setupFirstAdmin);

router.post("/admin/login", validateBody([
  { field: "email", type: "email", required: true },
  { field: "password", type: "string", required: true, minLength: 8 }
]), adminLogin);

router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
router.post("/google", googleCustomerLogin);
router.get("/me", authenticateToken, getCustomerProfile);
router.get("/me/orders", authenticateToken, getCustomerOrders);

export default router;
