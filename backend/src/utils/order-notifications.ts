export async function sendOrderStatusEmail(input: { email: string; name: string; orderNumber: string; status: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.info("Order status email skipped: RESEND_API_KEY or EMAIL_FROM is not configured.");
    return;
  }
  const store = process.env.STORE_NAME || "Our Store";
  const frontend = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  const tracking = frontend ? frontend + "/track" : "";
  const statusText = input.status.charAt(0).toUpperCase() + input.status.slice(1);
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#171717"><h2>${escapeHtml(store)}</h2><p>Hello ${escapeHtml(input.name)},</p><p>Your order <strong>${escapeHtml(input.orderNumber)}</strong> status has been updated to <strong>${escapeHtml(statusText)}</strong>.</p>${tracking ? `<p><a href="${escapeHtml(tracking)}">Track your order</a> using your order number and checkout email.</p>` : ""}<p>Thank you for shopping with us.</p></div>`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [input.email], subject: `Order ${input.orderNumber}: ${statusText}`, html })
    });
    if (!response.ok) console.error("Order status email provider returned", response.status, await response.text().catch(() => ""));
  } catch (error) {
    console.error("Order status email failed:", error);
  }
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}
