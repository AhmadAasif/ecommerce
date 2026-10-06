import { Request, Response } from "express";
import pool from "../config/database.js";
import {
  createRazorpayOrder,
  getRazorpayCurrency,
  getRazorpayPublicKey
} from "../services/payment.service.js";

export const createPaymentOrder = async (req: Request, res: Response) => {
  const { orderId } = req.body;

  if (!orderId || !Number.isInteger(Number(orderId))) {
    res.status(400).json({
      success: false,
      message: "A valid orderId is required"
    });
    return;
  }

  try {
    // Release reservations that have already expired.
    await pool.query(
      `UPDATE order_inventory_reservations
       SET status = 'released', released_at = CURRENT_TIMESTAMP
       WHERE status = 'reserved' AND expires_at <= CURRENT_TIMESTAMP`
    );

    const orderResult = await pool.query(
      `SELECT
         o.id,
         o.order_number,
         o.total_amount,
         o.payment_status,
         o.payment_order_id,
         o.order_status,
         o.customer_name,
         o.customer_email
       FROM orders o
       WHERE o.id = $1
       LIMIT 1`,
      [Number(orderId)]
    );

    if (!orderResult.rows.length) {
      res.status(404).json({
        success: false,
        message: "Order not found"
      });
      return;
    }

    const order = orderResult.rows[0];

    if (order.payment_status !== "pending") {
      res.status(400).json({
        success: false,
        message: "This order is no longer awaiting payment"
      });
      return;
    }

    if (order.order_status !== "pending") {
      res.status(400).json({
        success: false,
        message: "This order is no longer pending"
      });
      return;
    }

    if (order.payment_order_id) {
      res.json({
        success: true,
        message: "Payment order already created",
        data: {
          keyId: getRazorpayPublicKey(),
          currency: getRazorpayCurrency(),
          razorpayOrderId: order.payment_order_id,
          orderId: order.id,
          orderNumber: order.order_number,
          amount: Math.round(Number(order.total_amount) * 100),
          customer: {
            name: order.customer_name,
            email: order.customer_email
          }
        }
      });
      return;
    }

    const reservationResult = await pool.query(
      `SELECT
         COALESCE(SUM(quantity), 0) AS reserved_quantity,
         BOOL_OR(expires_at > CURRENT_TIMESTAMP) AS has_active_reservation
       FROM order_inventory_reservations
       WHERE order_id = $1 AND status = 'reserved'`,
      [order.id]
    );

    const reservation = reservationResult.rows[0];

    if (
      !reservation ||
      reservation.has_active_reservation !== true ||
      Number(reservation.reserved_quantity) <= 0
    ) {
      res.status(400).json({
        success: false,
        message: "Order reservation has expired. Please create a new order."
      });
      return;
    }

    const amount = Math.round(Number(order.total_amount) * 100);

    if (!Number.isInteger(amount) || amount <= 0) {
      res.status(400).json({
        success: false,
        message: "Invalid order amount"
      });
      return;
    }

    const razorpayOrder = await createRazorpayOrder({
      amount,
      receipt: order.order_number,
      notes: {
        orderId: String(order.id),
        orderNumber: order.order_number
      }
    });

    const updateResult = await pool.query(
      `UPDATE orders
       SET payment_order_id = $1,
           payment_provider = 'razorpay',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
         AND payment_status = 'pending'
         AND payment_order_id IS NULL
       RETURNING id, order_number, total_amount, payment_order_id`,
      [razorpayOrder.id, order.id]
    );

    // Another request may have created the payment order at the same time.
    if (!updateResult.rows.length) {
      const existingResult = await pool.query(
        `SELECT
           id,
           order_number,
           total_amount,
           payment_order_id
         FROM orders
         WHERE id = $1
         LIMIT 1`,
        [order.id]
      );

      const existing = existingResult.rows[0];

      if (!existing?.payment_order_id) {
        res.status(409).json({
          success: false,
          message: "Payment order could not be assigned. Please try again."
        });
        return;
      }

      res.json({
        success: true,
        message: "Payment order already created",
        data: {
          keyId: getRazorpayPublicKey(),
          currency: getRazorpayCurrency(),
          razorpayOrderId: existing.payment_order_id,
          orderId: existing.id,
          orderNumber: existing.order_number,
          amount: Math.round(Number(existing.total_amount) * 100)
        }
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: "Razorpay payment order created",
      data: {
        keyId: getRazorpayPublicKey(),
        currency: getRazorpayCurrency(),
        razorpayOrderId: razorpayOrder.id,
        orderId: order.id,
        orderNumber: order.order_number,
        amount,
        customer: {
          name: order.customer_name,
          email: order.customer_email
        }
      }
    });
  } catch (error) {
    console.error("Create payment order error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create payment order"
    });
  }
};
