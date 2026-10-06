import { Router } from "express";
import {
  createOrder,
  trackOrder
} from "../controllers/order.controller.js";

const router = Router();

router.post("/", createOrder);
router.post("/track", trackOrder);

export default router;
