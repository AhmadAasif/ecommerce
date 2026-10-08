import { Request, Response } from "express";
import pool from "../config/database.js";
import {
  createRazorpayOrder,
  getRazorpayCurrency,
  getRazorpayPublicKey,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature
} from "../services/payment.service.js";

export const createPaymentOrder = async (req: Request, res: Response) => {
  const { orderId, orderNumber, customerEmail } = req.body;

  if (!orderId || !Number.isInteger(Number(orderId)) ||
      typeof orderNumber !== "string" || !orderNumber.trim() ||
      typeof customerEmail !== "string" || !customerEmail.trim()) {
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
         AND o.order_number = $2
         AND LOWER(o.customer_email) = LOWER($3)
       LIMIT 1`,
      [Number(orderId), orderNumber.trim(), customerEmail.trim()]
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


export const verifyPayment = async (req: Request, res: Response) => {
  const {
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  } = req.body;

  if (
    !orderId ||
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature
  ) {
    res.status(400).json({
      success: false,
      message: "Payment verification details are required"
    });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT
         id,
         order_number,
         total_amount,
         payment_status,
         order_status,
         payment_order_id
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [Number(orderId)]
    );

    if (!orderResult.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({
        success: false,
        message: "Order not found"
      });
      return;
    }

    const order = orderResult.rows[0];

    if (order.payment_status === "paid") {
      await client.query("COMMIT");
      res.json({
        success: true,
        message: "Payment already verified",
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          paymentStatus: "paid"
        }
      });
      return;
    }

    if (order.payment_order_id !== razorpayOrderId) {
      await client.query("ROLLBACK");
      res.status(400).json({
        success: false,
        message: "Payment order does not match this order"
      });
      return;
    }

    const isValid = verifyRazorpayPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature
    });

    if (!isValid) {
      await client.query("ROLLBACK");
      res.status(400).json({
        success: false,
        message: "Invalid payment signature"
      });
      return;
    }

    const razorpayOrder = await fetchRazorpayOrder(razorpayOrderId);
    const razorpayPayment = await fetchRazorpayPayment(razorpayPaymentId);
    const expectedAmount = Math.round(Number(order.total_amount) * 100);

    if (
      razorpayOrder.id !== razorpayOrderId ||
      Number(razorpayOrder.amount) !== expectedAmount ||
      razorpayOrder.currency !== getRazorpayCurrency() ||
      razorpayPayment.order_id !== razorpayOrderId ||
      Number(razorpayPayment.amount) !== expectedAmount ||
      razorpayPayment.status !== "captured"
    ) {
      await client.query("ROLLBACK");
      res.status(409).json({
        success: false,
        message: "Razorpay payment does not match the order"
      });
      return;
    }

    const reservationResult = await client.query(
      `SELECT
         id,
         variant_id,
         quantity,
         expires_at
       FROM order_inventory_reservations
       WHERE order_id = $1
         AND status = 'reserved'
       FOR UPDATE`,
      [order.id]
    );

    if (!reservationResult.rows.length) {
      await client.query("ROLLBACK");
      res.status(409).json({
        success: false,
        message: "No active stock reservation exists for this order"
      });
      return;
    }

    for (const reservation of reservationResult.rows) {
      if (new Date(reservation.expires_at).getTime() <= Date.now()) {
        await client.query("ROLLBACK");
        res.status(409).json({
          success: false,
          message: "The order reservation has expired"
        });
        return;
      }

      const stockResult = await client.query(
        `UPDATE product_variants
         SET stock_quantity = stock_quantity - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
           AND stock_quantity >= $1
         RETURNING id, stock_quantity`,
        [reservation.quantity, reservation.variant_id]
      );

      if (!stockResult.rows.length) {
        await client.query("ROLLBACK");
        res.status(409).json({
          success: false,
          message: "Insufficient stock while completing payment"
        });
        return;
      }
    }

    await client.query(
      `UPDATE order_inventory_reservations
       SET status = 'consumed',
           consumed_at = CURRENT_TIMESTAMP
       WHERE order_id = $1
         AND status = 'reserved'`,
      [order.id]
    );

    await client.query(
      `UPDATE orders
       SET payment_status = 'paid',
           payment_id = $1,
           payment_provider = 'razorpay',
           paid_at = CURRENT_TIMESTAMP,
           order_status = 'confirmed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [razorpayPaymentId, order.id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Payment verified and order confirmed",
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentId: razorpayPaymentId,
        paymentStatus: "paid",
        orderStatus: "confirmed"
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Verify payment error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to verify payment"
    });
  } finally {
    client.release();
  }
};

export const handlePaymentWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["x-razorpay-signature"];

  if (typeof signature !== "string") {
    res.status(400).json({
      success: false,
      message: "Webhook signature is missing"
    });
    return;
  }

  const rawBody = req.body as Buffer;

  if (!Buffer.isBuffer(rawBody)) {
    res.status(400).json({
      success: false,
      message: "Webhook body must be received as raw data"
    });
    return;
  }

  try {
    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      res.status(400).json({
        success: false,
        message: "Invalid webhook signature"
      });
      return;
    }

    const event = JSON.parse(rawBody.toString("utf8"));
    const eventName = event.event;

    if (
      eventName !== "payment.captured" &&
      eventName !== "payment.failed"
    ) {
      res.status(200).json({
        success: true,
        message: "Webhook received"
      });
      return;
    }

    const payment = event.payload?.payment?.entity;

    if (!payment?.id || !payment?.order_id) {
      res.status(400).json({
        success: false,
        message: "Invalid payment webhook payload"
      });
      return;
    }

    if (eventName === "payment.captured") {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const orderResult = await client.query(
          `SELECT
             id,
             order_number,
             total_amount,
             payment_status,
             payment_order_id,
             order_status
           FROM orders
           WHERE payment_order_id = $1
           FOR UPDATE`,
          [payment.order_id]
        );

        if (!orderResult.rows.length) {
          await client.query("ROLLBACK");
          res.status(404).json({
            success: false,
            message: "Order for webhook payment not found"
          });
          return;
        }

        const order = orderResult.rows[0];

        if (order.payment_status === "paid") {
          await client.query("COMMIT");
          res.status(200).json({
            success: true,
            message: "Payment already processed"
          });
          return;
        }

        if (order.payment_order_id !== payment.order_id) {
          await client.query("ROLLBACK");
          res.status(400).json({
            success: false,
            message: "Payment order mismatch"
          });
          return;
        }

        const expectedAmount = Math.round(Number(order.total_amount) * 100);

        if (
          Number(payment.amount) !== expectedAmount ||
          payment.currency !== getRazorpayCurrency() ||
          payment.order_id !== order.payment_order_id ||
          payment.status !== "captured"
        ) {
          await client.query("ROLLBACK");
          res.status(409).json({
            success: false,
            message: "Webhook payment does not match the order"
          });
          return;
        }

        const reservationResult = await client.query(
          `SELECT
             id,
             variant_id,
             quantity,
             expires_at
           FROM order_inventory_reservations
           WHERE order_id = $1
             AND status = 'reserved'
           FOR UPDATE`,
          [order.id]
        );

        if (!reservationResult.rows.length) {
          await client.query("ROLLBACK");
          res.status(409).json({
            success: false,
            message: "No active reservation exists for this order"
          });
          return;
        }

        for (const reservation of reservationResult.rows) {
          if (new Date(reservation.expires_at).getTime() <= Date.now()) {
            await client.query("ROLLBACK");
            res.status(409).json({
              success: false,
              message: "Order reservation has expired"
            });
            return;
          }

          const stockResult = await client.query(
            `UPDATE product_variants
             SET stock_quantity = stock_quantity - $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
               AND stock_quantity >= $1
             RETURNING id`,
            [reservation.quantity, reservation.variant_id]
          );

          if (!stockResult.rows.length) {
            await client.query("ROLLBACK");
            res.status(409).json({
              success: false,
              message: "Insufficient stock while processing webhook"
            });
            return;
          }
        }

        await client.query(
          `UPDATE order_inventory_reservations
           SET status = 'consumed',
               consumed_at = CURRENT_TIMESTAMP
           WHERE order_id = $1
             AND status = 'reserved'`,
          [order.id]
        );

        await client.query(
          `UPDATE orders
           SET payment_status = 'paid',
               payment_id = $1,
               payment_provider = 'razorpay',
               paid_at = CURRENT_TIMESTAMP,
               order_status = 'confirmed',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [payment.id, order.id]
        );

        await client.query("COMMIT");

        res.status(200).json({
          success: true,
          message: "Payment webhook processed"
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      return;
    }

    await pool.query(
      `UPDATE order_inventory_reservations r
       SET status = 'released',
           released_at = CURRENT_TIMESTAMP
       FROM orders o
       WHERE r.order_id = o.id
         AND o.payment_order_id = $1
         AND r.status = 'reserved'`,
      [payment.order_id]
    );

    await pool.query(
      `UPDATE orders
       SET payment_status = 'failed',
           order_status = 'cancelled',
           payment_id = $1,
           payment_provider = 'razorpay',
           updated_at = CURRENT_TIMESTAMP
       WHERE payment_order_id = $2
         AND payment_status = 'pending'`,
      [payment.id, payment.order_id]
    );

    res.status(200).json({
      success: true,
      message: "Payment failure webhook processed"
    });
  } catch (error) {
    console.error("Payment webhook error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to process payment webhook"
    });
  }
};
