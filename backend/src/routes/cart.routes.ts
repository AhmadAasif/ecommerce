import { Router } from "express";
import {
  createCart,
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart
} from "../controllers/cart.controller.js";

const router = Router();

router.post("/", createCart);
router.post("/:cartId/items", addToCart);
router.get("/:cartId", getCart);
router.put("/:cartId/items/:itemId", updateCartItem);
router.delete("/:cartId/items/:itemId", removeCartItem);
router.delete("/:cartId/items", clearCart);

export default router;
