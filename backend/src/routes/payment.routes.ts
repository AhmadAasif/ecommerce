import { Router } from "express";
import { createPaymentOrder } from "../controllers/payment.controller.js";

const router = Router();

router.post("/create-order", createPaymentOrder);

export default router;
