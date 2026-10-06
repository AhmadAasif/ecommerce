import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const currency = process.env.RAZORPAY_CURRENCY || "INR";

if (!keyId || !keySecret) {
  throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required");
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret
});

export const createRazorpayOrder = async ({
  amount,
  receipt,
  notes
}: {
  amount: number;
  receipt: string;
  notes?: Record<string, string>;
}) => {
  return razorpay.orders.create({
    amount,
    currency,
    receipt,
    notes
  });
};

export const getRazorpayPublicKey = () => keyId;

export const getRazorpayCurrency = () => currency;
