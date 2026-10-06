import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import pool from "./config/database.js";
import { requestRateLimit, cleanupRateLimitStore } from "./middleware/security.middleware.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";

import categoryRoutes from "./routes/category.routes.js";
import productRoutes from "./routes/product.routes.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import adminProductRoutes from "./routes/admin-product.routes.js";
import adminVariantRoutes from "./routes/admin-variant.routes.js";
import adminImageRoutes from "./routes/admin-image.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import adminOrderRoutes from "./routes/admin-order.routes.js";
import adminInventoryRoutes from "./routes/admin-inventory.routes.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.set("trust proxy", 1);
app.disable("x-powered-by");

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS"));
    }
  })
);
app.use(requestRateLimit);
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/admin", adminVariantRoutes);
app.use("/api/admin", adminImageRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminOrderRoutes);
app.use("/api/admin", adminInventoryRoutes);

app.get("/api/health", async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      success: true,
      message: "E-commerce backend is running",
      database: "connected",
      databaseTime: result.rows[0].now
    });
  } catch (error) {
    next(error);
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

const cleanupTimer = setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
cleanupTimer.unref();

const server = app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
