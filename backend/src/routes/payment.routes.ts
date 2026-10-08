import { Router } from "express";
import {
  createPaymentOrder,
  verifyPayment,
  handlePaymentWebhook
} from "../controllers/payment.controller.js";
import { validateBody } from "../middleware/validation.middleware.js";

const router = Router();

router.post(
  "/create-order",
  validateBody([{ field: "orderId", type: "number", required: true },
    { field: "orderNumber", type: "string", required: true },
    { field: "customerEmail", type: "string", required: true }]),
  createPaymentOrder
);

router.post(
  "/verify",
  validateBody([
    { field: "orderId", type: "number", required: true },
    { field: "razorpayOrderId", type: "string", required: true },
    { field: "razorpayPaymentId", type: "string", required: true },
    { field: "razorpaySignature", type: "string", required: true }
  ]),
  verifyPayment
);

router.post("/webhook", handlePaymentWebhook);

export default router;
