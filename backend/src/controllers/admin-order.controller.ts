import { Request, Response } from "express";
import pool from "../config/database.js";
import { sendOrderStatusEmail, sendRefundConfirmationEmail } from "../utils/order-notifications.js";
import { createRazorpayRefund } from "../services/payment.service.js";

const ALLOWED_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled"
] as const;

type OrderStatus = (typeof ALLOWED_ORDER_STATUSES)[number];

export const getAdminOrders = async (req: Request, res: Response) => {
  try {
    const status =
      typeof req.query.status === "string" ? req.query.status.trim() : "";
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    if (status && !ALLOWED_ORDER_STATUSES.includes(status as OrderStatus)) {
      res.status(400).json({
        success: false,
        message: "Invalid order status"
      });
      return;
    }

    const values: string[] = [];
    const conditions: string[] = [];

    if (status) {
      values.push(status);
      conditions.push(`o.order_status = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(
        o.order_number ILIKE $${values.length}
        OR o.customer_name ILIKE $${values.length}
        OR o.customer_email ILIKE $${values.length}
        OR o.customer_phone ILIKE $${values.length}
      )`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `SELECT
         o.id,
         o.order_number,
         o.customer_name,
         o.customer_email,
         o.customer_phone,
         o.subtotal,
         o.shipping_fee,
         o.discount_amount,
         o.total_amount,
         o.payment_status,
         o.order_status,
         o.created_at,
         o.updated_at,
         COUNT(oi.id)::INTEGER AS item_count
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${whereClause}
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      values
    );

    res.json({
      success: true,
      data: {
        orders: result.rows,
        count: result.rows.length
      }
    });
  } catch (error) {
    console.error("Get admin orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders"
    });
  }
};

export const getAdminOrderById = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID"
      });
      return;
    }

    const orderResult = await pool.query(
      `SELECT
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
         payment_provider,
         payment_id,
         paid_at,
         created_at,
         updated_at
       FROM orders
       WHERE id = $1`,
      [orderId]
    );

    if (!orderResult.rows.length) {
      res.status(404).json({
        success: false,
        message: "Order not found"
      });
      return;
    }

    const itemsResult = await pool.query(
      `SELECT
         id,
         product_id,
         variant_id,
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
      [orderId]
    );

    const reservationsResult = await pool.query(
      `SELECT
         id,
         variant_id,
         quantity,
         status,
         expires_at,
         created_at,
         released_at,
         consumed_at
       FROM order_inventory_reservations
       WHERE order_id = $1
       ORDER BY id ASC`,
      [orderId]
    );

    res.json({
      success: true,
      data: {
        order: orderResult.rows[0],
        items: itemsResult.rows,
        inventoryReservations: reservationsResult.rows
      }
    });
  } catch (error) {
    console.error("Get admin order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order"
    });
  }
};

export const updateAdminOrderStatus = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      res.status(400).json({
        success: false,
        message: "Invalid order ID"
      });
      return;
    }

    if (
      typeof status !== "string" ||
      !ALLOWED_ORDER_STATUSES.includes(status as OrderStatus)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid order status"
      });
      return;
    }

    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT id, order_number, customer_name, customer_email, order_status, payment_status
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (!orderResult.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({
        success: false,
        message: "Order not found"
      });
      return;
    }

    const currentOrder = orderResult.rows[0];

    if (currentOrder.order_status === status) {
      await client.query("COMMIT");
      res.json({
        success: true,
        message: "Order status is already set to this value"
      });
      return;
    }

    if (
      currentOrder.order_status === "delivered" &&
      status !== "delivered"
    ) {
      await client.query("ROLLBACK");
      res.status(400).json({
        success: false,
        message: "A delivered order cannot be moved back to another status"
      });
      return;
    }

    if (
      currentOrder.order_status === "cancelled" &&
      status !== "cancelled"
    ) {
      await client.query("ROLLBACK");
      res.status(400).json({
        success: false,
        message: "A cancelled order cannot be reopened"
      });
      return;
    }

    if (status === "cancelled") {
      const reservations = await client.query(
        `SELECT id, variant_id, quantity, status
         FROM order_inventory_reservations
         WHERE order_id = $1
           AND status IN ('reserved', 'consumed')
         FOR UPDATE`,
        [orderId]
      );

      for (const reservation of reservations.rows) {
        if (reservation.status === "consumed") {
          await client.query(
            `UPDATE product_variants
             SET stock_quantity = stock_quantity + $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [reservation.quantity, reservation.variant_id]
          );
        }

        await client.query(
          `UPDATE order_inventory_reservations
           SET status = 'released',
               released_at = CURRENT_TIMESTAMP,
               consumed_at = CASE
                 WHEN status = 'consumed' THEN consumed_at
                 ELSE consumed_at
               END
           WHERE id = $1`,
          [reservation.id]
        );
      }

      if (currentOrder.payment_status === "paid") {
        // Payment refunds are intentionally not automated here.
        // Razorpay refund handling will be added as a separate payment operation.
        await client.query(
          `UPDATE orders
           SET order_status = 'cancelled',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [orderId]
        );
      } else {
        await client.query(
          `UPDATE orders
           SET order_status = 'cancelled',
               payment_status = CASE
                 WHEN payment_status = 'pending' THEN 'failed'
                 ELSE payment_status
               END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [orderId]
        );
      }
    } else {
      await client.query(
        `UPDATE orders
         SET order_status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [status, orderId]
      );
    }

    await client.query(
      "INSERT INTO order_status_history (order_id, status, note) VALUES ($1, $2, $3)",
      [orderId, status, "Order status updated by the store"]
    );
    await client.query("COMMIT");
    void sendOrderStatusEmail({ email: currentOrder.customer_email, name: currentOrder.customer_name, orderNumber: currentOrder.order_number, status });
    res.json({ success: true, message: `Order status updated to ${status}` });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update admin order status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update order status"
    });
  } finally {
    client.release();
  }
};

export const refundAdminOrder = async (req: Request, res: Response) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    res.status(400).json({ success: false, message: "Invalid order ID" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, order_number, customer_name, customer_email, total_amount,
              payment_status, payment_id, refund_id, refund_status
       FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }
    const order = result.rows[0];
    if (order.refund_id) {
      await client.query("COMMIT");
      res.status(409).json({ success: false, message: "A refund has already been initiated for this order", data: { refundId: order.refund_id, refundStatus: order.refund_status } });
      return;
    }
    if (order.payment_status !== "paid" || !order.payment_id) {
      await client.query("ROLLBACK");
      res.status(400).json({ success: false, message: "Only paid orders with a payment reference can be refunded" });
      return;
    }

    // Razorpay expects the amount in the smallest currency unit (paise for INR).
    const amountInMinorUnits = Math.round(Number(order.total_amount) * 100);
    if (!Number.isSafeInteger(amountInMinorUnits) || amountInMinorUnits <= 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ success: false, message: "Invalid order amount for refund" });
      return;
    }

    // Do not hold a database transaction open during the external payment API call.
    await client.query("COMMIT");
    const refund = await createRazorpayRefund(order.payment_id, amountInMinorUnits, order.order_number);
    const refundStatus = String(refund.status || "pending");
    await pool.query(
      `UPDATE orders SET refund_id = $1, refund_status = $2,
          refunded_at = CASE WHEN $2 = 'processed' THEN CURRENT_TIMESTAMP ELSE refunded_at END,
          payment_status = CASE WHEN $2 = 'processed' THEN 'refunded' ELSE payment_status END,
          updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND refund_id IS NULL`,
      [refund.id, refundStatus, order.id]
    );

    if (refundStatus === "processed" || refundStatus === "pending") {
      void sendRefundConfirmationEmail({
        email: order.customer_email,
        name: order.customer_name,
        orderNumber: order.order_number,
        refundAmount: Number(refund.amount) / 100,
        refundId: refund.id
      });
    }
    res.status(200).json({
      success: true,
      message: "Refund request sent to Razorpay",
      data: { refundId: refund.id, refundStatus, amount: Number(refund.amount) / 100 }
    });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be committed */ }
    console.error("Refund admin order error:", error);
    res.status(500).json({ success: false, message: "Failed to initiate refund. Check Razorpay dashboard before retrying." });
  } finally {
    client.release();
  }
};
