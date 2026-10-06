import { Request, Response } from "express";
import pool from "../config/database.js";

const getRouteParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

const isValidUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const createCart = async (req: Request, res: Response) => {
  try {
    const sessionId = typeof req.body.sessionId === "string"
      ? req.body.sessionId.trim()
      : "";

    if (!sessionId) {
      res.status(400).json({
        success: false,
        message: "sessionId is required"
      });
      return;
    }

    const existing = await pool.query(
      `SELECT id, session_id, created_at
       FROM carts
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );

    if (existing.rows.length) {
      res.json({
        success: true,
        message: "Existing cart returned",
        data: existing.rows[0]
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO carts (session_id)
       VALUES ($1)
       RETURNING id, session_id, created_at`,
      [sessionId]
    );

    res.status(201).json({
      success: true,
      message: "Cart created successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Create cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create cart"
    });
  }
};

export const addToCart = async (req: Request, res: Response) => {
  try {
    const cartId = getRouteParam(req.params.cartId);
    const { productId, variantId, quantity } = req.body;

    if (!isValidUuid(cartId)) {
      res.status(400).json({ success: false, message: "Invalid cart ID" });
      return;
    }

    if (!productId || !variantId || quantity === undefined) {
      res.status(400).json({
        success: false,
        message: "Product, variant and quantity are required"
      });
      return;
    }

    const requestedQuantity = Number(quantity);

    if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
      res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer"
      });
      return;
    }

    const cart = await pool.query(
      "SELECT id FROM carts WHERE id = $1",
      [cartId]
    );

    if (!cart.rows.length) {
      res.status(404).json({
        success: false,
        message: "Cart not found"
      });
      return;
    }

    const variantResult = await pool.query(
      `SELECT
         pv.id,
         pv.product_id,
         pv.price,
         pv.stock_quantity,
         pv.status,
         p.name AS product_name,
         p.status AS product_status
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.id = $1
         AND pv.product_id = $2`,
      [variantId, productId]
    );

    if (!variantResult.rows.length) {
      res.status(404).json({
        success: false,
        message: "Product variant not found"
      });
      return;
    }

    const variant = variantResult.rows[0];

    if (variant.status !== "active" || variant.product_status !== "active") {
      res.status(400).json({
        success: false,
        message: "Product is not available"
      });
      return;
    }

    // Active reservations are temporarily unavailable to other customers.
    await pool.query(
      `UPDATE order_inventory_reservations
       SET status = 'released', released_at = CURRENT_TIMESTAMP
       WHERE status = 'reserved' AND expires_at <= CURRENT_TIMESTAMP`
    );

    const reservedResult = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS reserved_quantity
       FROM order_inventory_reservations
       WHERE variant_id = $1 AND status = 'reserved'`,
      [variantId]
    );

    const reservedQuantity = Number(
      reservedResult.rows[0].reserved_quantity
    );

    const availableStock =
      Number(variant.stock_quantity) - reservedQuantity;

    const existing = await pool.query(
      `SELECT id, quantity
       FROM cart_items
       WHERE cart_id = $1 AND variant_id = $2`,
      [cartId, variantId]
    );

    const existingQuantity = existing.rows.length
      ? Number(existing.rows[0].quantity)
      : 0;

    const newQuantity = existingQuantity + requestedQuantity;

    if (newQuantity > availableStock) {
      res.status(400).json({
        success: false,
        message: `Only ${availableStock} items available in stock`,
        availableStock,
        requestedQuantity: newQuantity
      });
      return;
    }

    const result = existing.rows.length
      ? await pool.query(
          `UPDATE cart_items
           SET quantity = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING id, cart_id, product_id, variant_id, quantity`,
          [newQuantity, existing.rows[0].id]
        )
      : await pool.query(
          `INSERT INTO cart_items
             (cart_id, product_id, variant_id, quantity)
           VALUES ($1, $2, $3, $4)
           RETURNING id, cart_id, product_id, variant_id, quantity`,
          [cartId, productId, variantId, requestedQuantity]
        );

    await pool.query(
      "UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [cartId]
    );

    res.status(201).json({
      success: true,
      message: "Product added to cart",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add product to cart"
    });
  }
};

export const getCart = async (req: Request, res: Response) => {
  try {
    const { cartId } = req.params;

    if (!isValidUuid(cartId)) {
      res.status(400).json({ success: false, message: "Invalid cart ID" });
      return;
    }

    const cart = await pool.query(
      "SELECT id, session_id, created_at, updated_at FROM carts WHERE id = $1",
      [cartId]
    );

    if (!cart.rows.length) {
      res.status(404).json({
        success: false,
        message: "Cart not found"
      });
      return;
    }

    const result = await pool.query(
      `SELECT
         ci.id,
         ci.product_id,
         ci.variant_id,
         ci.quantity,
         p.name,
         p.description,
         pv.sku,
         pv.size,
         pv.color,
         COALESCE(pv.price, p.price) AS price,
         (ci.quantity * COALESCE(pv.price, p.price)) AS item_total,
         (
           SELECT pi.image_url
           FROM product_images pi
           WHERE pi.product_id = p.id
           ORDER BY pi.is_primary DESC, pi.id ASC
           LIMIT 1
         ) AS image_url
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN product_variants pv ON pv.id = ci.variant_id
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at ASC`,
      [cartId]
    );

    const subtotal = result.rows.reduce(
      (total, item) => total + Number(item.item_total),
      0
    );

    const itemCount = result.rows.reduce(
      (count, item) => count + Number(item.quantity),
      0
    );

    res.json({
      success: true,
      data: {
        cart: cart.rows[0],
        items: result.rows,
        subtotal,
        itemCount
      }
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cart"
    });
  }
};

export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const cartId = getRouteParam(req.params.cartId);\n    const itemId = getRouteParam(req.params.itemId);
    const requestedQuantity = Number(req.body.quantity);

    if (!isValidUuid(cartId)) {
      res.status(400).json({ success: false, message: "Invalid cart ID" });
      return;
    }

    if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
      res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer"
      });
      return;
    }

    await pool.query(
      `UPDATE order_inventory_reservations
       SET status = 'released', released_at = CURRENT_TIMESTAMP
       WHERE status = 'reserved' AND expires_at <= CURRENT_TIMESTAMP`
    );

    const result = await pool.query(
      `UPDATE cart_items ci
       SET quantity = $1, updated_at = CURRENT_TIMESTAMP
       FROM product_variants pv
       WHERE ci.id = $2
         AND ci.cart_id = $3
         AND ci.variant_id = pv.id
         AND pv.status = 'active'
         AND pv.stock_quantity - (
           SELECT COALESCE(SUM(r.quantity), 0)
           FROM order_inventory_reservations r
           WHERE r.variant_id = pv.id
             AND r.status = 'reserved'
         ) >= $1
       RETURNING ci.id, ci.product_id, ci.variant_id, ci.quantity`,
      [requestedQuantity, itemId, cartId]
    );

    if (!result.rows.length) {
      res.status(400).json({
        success: false,
        message: "Unable to update quantity or insufficient stock"
      });
      return;
    }

    await pool.query(
      "UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [cartId]
    );

    res.json({
      success: true,
      message: "Cart item updated",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Update cart item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update cart item"
    });
  }
};

export const removeCartItem = async (req: Request, res: Response) => {
  try {
    const { cartId, itemId } = req.params;

    if (!isValidUuid(cartId)) {
      res.status(400).json({ success: false, message: "Invalid cart ID" });
      return;
    }

    const result = await pool.query(
      `DELETE FROM cart_items
       WHERE id = $1 AND cart_id = $2
       RETURNING id`,
      [itemId, cartId]
    );

    if (!result.rows.length) {
      res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
      return;
    }

    await pool.query(
      "UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [cartId]
    );

    res.json({
      success: true,
      message: "Cart item removed"
    });
  } catch (error) {
    console.error("Remove cart item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove cart item"
    });
  }
};

export const clearCart = async (req: Request, res: Response) => {
  try {
    const { cartId } = req.params;

    if (!isValidUuid(cartId)) {
      res.status(400).json({ success: false, message: "Invalid cart ID" });
      return;
    }

    const result = await pool.query(
      "DELETE FROM cart_items WHERE cart_id = $1 RETURNING id",
      [cartId]
    );

    await pool.query(
      "UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [cartId]
    );

    res.json({
      success: true,
      message: "Cart cleared successfully",
      removedItems: result.rowCount ?? 0
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear cart"
    });
  }
};
