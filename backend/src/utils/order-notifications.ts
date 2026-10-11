import { sendGmailMessage } from "../services/gmail-oauth.service.js";

export async function sendOrderStatusEmail(input: {
  email: string;
  name: string;
  orderNumber: string;
  status: string;
}) {
  const store = process.env.STORE_NAME || "KVNEM";
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
  const store = process.env.STORE_NAME || "KVNEM";
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
