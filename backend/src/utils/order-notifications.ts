import { sendGmailMessage } from "../services/gmail-oauth.service.js";

export async function sendOrderStatusEmail(input: {
  email: string;
  name: string;
  orderNumber: string;
  status: string;
}) {
  const store = process.env.STORE_NAME || "PNKSHOP";
  const frontend = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  const tracking = frontend ? frontend + "/track" : "";
  const statusText = input.status.charAt(0).toUpperCase() + input.status.slice(1);
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><h2>${escapeHtml(store)}</h2><p>Hello ${escapeHtml(input.name)},</p><p>Your order <strong>${escapeHtml(input.orderNumber)}</strong> status has been updated to <strong>${escapeHtml(statusText)}</strong>.</p>${tracking ? `<p><a href="${escapeHtml(tracking)}">Track your order</a> using your order number and checkout email.</p>` : ""}<p>Thank you for shopping with us.</p></div>`;
  try {
    await sendGmailMessage({
      to: input.email,
      subject: `Order ${input.orderNumber}: ${statusText}`,
      html
    });
  } catch (error) {
    console.error("Order status email failed:", error);
  }
}

export async function sendPaymentConfirmationEmail(input: {
  email: string;
  name: string;
  orderNumber: string;
  totalAmount: number | string;
}) {
  const store = process.env.STORE_NAME || "PNKSHOP";
  const frontend = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  const tracking = frontend ? frontend + "/track" : "";
  const amount = Number(input.totalAmount);
  const formattedAmount = Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount)
    : String(input.totalAmount);
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><h2>${escapeHtml(store)}</h2><p>Hello ${escapeHtml(input.name)},</p><p>We've received your payment for order <strong>${escapeHtml(input.orderNumber)}</strong>.</p><p><strong>Amount paid:</strong> ${escapeHtml(formattedAmount)}</p><p>Your order is now confirmed. We'll email you again when its status changes.</p>${tracking ? `<p><a href="${escapeHtml(tracking)}">Track your order</a> using your order number and checkout email.</p>` : ""}<p>Thank you for shopping with us.</p></div>`;
  try {
    await sendGmailMessage({
      to: input.email,
      subject: `Payment received for order ${input.orderNumber}`,
      html
    });
  } catch (error) {
    console.error("Payment confirmation email failed:", error);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

export async function sendNewOrderAdminEmail(input: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number | string;
}) {
  const recipient = process.env.STORE_ADMIN_EMAIL?.trim();
  if (!recipient) {
    console.warn("New-order admin email skipped: STORE_ADMIN_EMAIL is not configured.");
    return;
  }
  const store = process.env.STORE_NAME || "PNKSHOP";
  const amount = Number(input.totalAmount);
  const formattedAmount = Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount)
    : String(input.totalAmount);
  const adminUrl = (process.env.FRONTEND_URL || "").replace(/\/$/, "") + "/admin";
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><h2>${escapeHtml(store)}</h2><h3>New order received</h3><p>A new order has been placed and is awaiting payment.</p><p><strong>Order:</strong> ${escapeHtml(input.orderNumber)}</p><p><strong>Customer:</strong> ${escapeHtml(input.customerName)}</p><p><strong>Customer email:</strong> ${escapeHtml(input.customerEmail)}</p><p><strong>Order total:</strong> ${escapeHtml(formattedAmount)}</p>${adminUrl ? `<p><a href="${escapeHtml(adminUrl)}">Open admin panel</a></p>` : ""}</div>`;
  try {
    await sendGmailMessage({ to: recipient, subject: `New order ${input.orderNumber} | ${store}`, html });
  } catch (error) {
    console.error("New-order admin email failed:", error);
  }
}

export async function sendRefundConfirmationEmail(input: {
  email: string;
  name: string;
  orderNumber: string;
  refundAmount: number | string;
  refundId: string;
}) {
  const store = process.env.STORE_NAME || "PNKSHOP";
  const amount = Number(input.refundAmount);
  const formattedAmount = Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount)
    : String(input.refundAmount);
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><h2>${escapeHtml(store)}</h2><p>Hello ${escapeHtml(input.name)},</p><p>Your refund for order <strong>${escapeHtml(input.orderNumber)}</strong> has been initiated successfully.</p><p><strong>Refund amount:</strong> ${escapeHtml(formattedAmount)}</p><p><strong>Refund reference:</strong> ${escapeHtml(input.refundId)}</p><p>Your bank or payment provider may take additional time to reflect the refund.</p><p>Thank you for your patience.</p></div>`;
  try {
    await sendGmailMessage({ to: input.email, subject: `Refund initiated for order ${input.orderNumber}`, html });
  } catch (error) {
    console.error("Refund confirmation email failed:", error);
  }
}
