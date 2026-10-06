import { Router } from "express";
import {
  createPaymentOrder,
  verifyPayment,
  handlePaymentWebhook
} from "../controllers/payment.controller.js";

const router = Router();

router.post("/create-order", createPaymentOrder);
router.post("/verify", verifyPayment);
router.post("/webhook", handlePaymentWebhook);

export default router;
