import crypto from "crypto";
import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

const keyId = process.env.RAZORPAY_KEY_ID || "";
const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
const currency = process.env.RAZORPAY_CURRENCY || "INR";

const razorpay = keyId && keySecret
  ? new Razorpay({ key_id: keyId, key_secret: keySecret })
  : null;

function requireRazorpay() {
  if (!razorpay) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required");
  }
  return razorpay;
}

export const createRazorpayOrder = async ({
  amount,
  receipt,
  notes
}: {
  amount: number;
  receipt: string;
  notes?: Record<string, string>;
}) => {
  return requireRazorpay().orders.create({
    amount,
    currency,
    receipt,
    notes
  });
};

export const getRazorpayPublicKey = () => keyId;

export const getRazorpayCurrency = () => currency;

export const fetchRazorpayOrder = async (orderId: string) => {
  return requireRazorpay().orders.fetch(orderId);
};

export const fetchRazorpayPayment = async (paymentId: string) => {
  return requireRazorpay().payments.fetch(paymentId);
};

export const verifyRazorpayPaymentSignature = ({
  orderId,
  paymentId,
  signature
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}) => {
  if (!keySecret) return false;
  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expected = Buffer.from(generatedSignature, "utf8");
  const received = Buffer.from(signature, "utf8");

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
};

export const verifyRazorpayWebhookSignature = (
  rawBody: Buffer,
  signature: string
) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET is required");
  }

  const generatedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const expected = Buffer.from(generatedSignature, "utf8");
  const received = Buffer.from(signature, "utf8");

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
};
