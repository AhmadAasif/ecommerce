import { Request, Response } from "express";
import pool from "../config/database.js";

const ORDER_RESERVATION_MINUTES = 15;

const generateOrderNumber = () =>
  `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const createOrder = async (req: Request, res: Response) => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    res.status(503).json({
      success: false,
      message: "Online payments are not configured yet. Please try checkout later."
    });
    return;
  }

  const client = await pool.connect();

  try {
    const {
      cartId,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress
    } = req.body;

    if (
      !cartId ||
      !customerName ||
      !customerEmail ||
      !customerPhone ||
      !shippingAddress
    ) {
      res.status(400).json({
        success: false,
        message: "All checkout details are required"
      });
      return;
    }

    await client.query("BEGIN");

    // Release expired reservations before checking available stock.
    await client.query(
      `UPDATE order_inventory_reservations
       SET status = 'released', released_at = CURRENT_TIMESTAMP
       WHERE status = 'reserved' AND expires_at <= CURRENT_TIMESTAMP`
    );

    const cartResult = await client.query(
      `SELECT
         ci.id AS cart_item_id,
         ci.product_id,
         ci.variant_id,
         ci.quantity,
         p.name AS product_name,
         p.status AS product_status,
         pv.sku,
         pv.size,
         pv.color,
         pv.price,
         pv.stock_quantity,
         pv.status AS variant_status
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN product_variants pv ON pv.id = ci.variant_id
       WHERE ci.cart_id = $1
       FOR UPDATE OF pv`,
      [cartId]
    );

    if (!cartResult.rows.length) {
      await client.query("ROLLBACK");
      res.status(400).json({
        success: false,
        message: "Cart is empty"
      });
      return;
    }

    let subtotal = 0;

    for (const item of cartResult.rows) {
      if (
        item.product_status !== "active" ||
        item.variant_status !== "active"
      ) {
        await client.query("ROLLBACK");
        res.status(400).json({
          success: false,
          message: `${item.product_name} is no longer available`
        });
        return;
      }

      const reservedResult = await client.query(
        `SELECT COALESCE(SUM(quantity), 0) AS reserved_quantity
         FROM order_inventory_reservations
         WHERE variant_id = $1 AND status = 'reserved'`,
        [item.variant_id]
      );

      const reservedQuantity = Number(
        reservedResult.rows[0].reserved_quantity
      );

      const availableQuantity =
        Number(item.stock_quantity) - reservedQuantity;

      if (Number(item.quantity) > availableQuantity) {
        await client.query("ROLLBACK");
        res.status(400).json({
          success: false,
          message: `Only ${availableQuantity} items available for ${item.product_name}`,
          availableStock: availableQuantity
        });
        return;
      }

      subtotal += Number(item.price) * Number(item.quantity);
    }

    const shippingFee = subtotal >= 2000 ? 0 : 100;
    const totalAmount = subtotal + shippingFee;
    const orderNumber = generateOrderNumber();

    const expiresAt = new Date(
      Date.now() + ORDER_RESERVATION_MINUTES * 60 * 1000
    );

    const orderResult = await client.query(
      `INSERT INTO orders (
         order_number,
         customer_name,
         customer_email,
         customer_phone,
         shipping_address,
         subtotal,
         shipping_fee,
         discount_amount,
         total_amount,
         payment_status,
         order_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, 'pending', 'pending')
       RETURNING
         id,
         order_number,
         customer_name,
         customer_email,
         customer_phone,
         shipping_address,
         subtotal,
         shipping_fee,
         discount_amount,
         total_amount,
         payment_status,
         order_status,
         created_at`,
      [
        orderNumber,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        subtotal,
        shippingFee,
        totalAmount
      ]
    );

    const order = orderResult.rows[0];

    for (const item of cartResult.rows) {
      await client.query(
        `INSERT INTO order_items (
           order_id,
           product_id,
           variant_id,
           product_name,
           sku,
           size,
           color,
           quantity,
           unit_price,
           total_price
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          order.id,
          item.product_id,
          item.variant_id,
          item.product_name,
          item.sku,
          item.size,
          item.color,
          item.quantity,
          item.price,
          Number(item.price) * Number(item.quantity)
        ]
      );

      // Reserve stock instead of permanently consuming it.
      // Payment confirmation will consume the reservation later.
      await client.query(
        `INSERT INTO order_inventory_reservations (
           order_id,
           variant_id,
           quantity,
           status,
           expires_at
         )
         VALUES ($1, $2, $3, 'reserved', $4)`,
        [order.id, item.variant_id, item.quantity, expiresAt]
      );
    }

    // The cart is cleared only after the pending order and reservations
    // have been created successfully inside the same transaction.
    await client.query(
      "DELETE FROM cart_items WHERE cart_id = $1",
      [cartId]
    );

    await client.query(
      "UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [cartId]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Order created and stock reserved for payment",
      data: {
        order,
        reservationExpiresAt: expiresAt,
        reservationMinutes: ORDER_RESERVATION_MINUTES
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create order error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create order"
    });
  } finally {
    client.release();
  }
};

export const trackOrder = async (req: Request, res: Response) => {
  try {
    const { orderNumber, email } = req.body;

    const normalizedOrderNumber =
      typeof orderNumber === "string" ? orderNumber.trim() : "";
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedOrderNumber || !normalizedEmail) {
      res.status(400).json({
        success: false,
        message: "Order number and email are required"
      });
      return;
    }

    const orderResult = await pool.query(
      `SELECT
         id,
         order_number,
         customer_name,
         subtotal,
         shipping_fee,
         discount_amount,
         total_amount,
         payment_status,
         order_status,
         created_at,
         updated_at
       FROM orders
       WHERE order_number = $1
         AND LOWER(customer_email) = $2`,
      [normalizedOrderNumber, normalizedEmail]
    );

    if (!orderResult.rows.length) {
      res.status(404).json({
        success: false,
        message: "Order not found or verification details do not match"
      });
      return;
    }

    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT
         product_name,
         sku,
         size,
         color,
         quantity,
         unit_price,
         total_price
       FROM order_items
       WHERE order_id = $1
       ORDER BY id ASC`,
      [order.id]
    );

    res.json({
      success: true,
      data: {
        order: {
          orderNumber: order.order_number,
          customerName: order.customer_name,
          subtotal: order.subtotal,
          shippingFee: order.shipping_fee,
          discountAmount: order.discount_amount,
          totalAmount: order.total_amount,
          paymentStatus: order.payment_status,
          orderStatus: order.order_status,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          items: itemsResult.rows
        }
      }
    });
  } catch (error) {
    console.error("Track order error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to track order"
    });
  }
};
