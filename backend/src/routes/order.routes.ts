import { Router } from "express";
import { createOrder, trackOrder } from "../controllers/order.controller.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { optionalCustomerAuth } from "../middleware/optional-customer-auth.middleware.js";

const router = Router();

router.post(
  "/",
  optionalCustomerAuth,
  validateBody([
    { field: "cartId", type: "string", required: true },
    { field: "customerName", type: "string", required: true, minLength: 2 },
    { field: "customerEmail", type: "email", required: true },
    { field: "customerPhone", type: "string", required: true, minLength: 7 },
    { field: "shippingAddress", type: "string", required: true, minLength: 10 }
  ]),
  createOrder
);

router.post(
  "/track",
  validateBody([
    { field: "orderNumber", type: "string", required: true, minLength: 5 },
    { field: "email", type: "email", required: true }
  ]),
  trackOrder
);

export default router;
