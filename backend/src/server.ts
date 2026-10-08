import express from "express";
import { runMigrations } from "./utils/migrations.js";
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
import adminOrderRoutes from "./routes/admin-order.routes.js";
import adminInventoryRoutes from "./routes/admin-inventory.routes.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const HOST = "0.0.0.0";

app.set("trust proxy", 1);
app.disable("x-powered-by");

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, "");
  if (allowedOrigins.includes("*") || allowedOrigins.includes(normalized)) return true;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" &&
      (/^ecommerce-[a-z0-9-]+-kvnem\.vercel\.app$/i.test(url.hostname) ||
       url.hostname === "ecommerce-cyan-eta-82.vercel.app");
  } catch {
    return false;
  }
}

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    }
  })
);
app.use(requestRateLimit);
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/api/health/live", (_req, res) => {
  res.status(200).json({ success: true, status: "alive" });
});

app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/admin", adminVariantRoutes);
app.use("/api/admin", adminImageRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

async function startServer() {
  await runMigrations();

  app.get("/api/payments/status", (_req, res) => {
    res.json({ success: true, data: { enabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) } });
  });

  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    const paymentRoutes = (await import("./routes/payment.routes.js")).default;
    app.use("/api/payments", paymentRoutes);
    console.log("Razorpay payment routes enabled.");
  } else {
    app.use("/api/payments", (_req, res) => {
      res.status(503).json({ success: false, message: "Online payments are not configured yet." });
    });
    console.warn("Online payments are disabled until Razorpay credentials are configured.");
  }

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

  const server = app.listen(PORT, HOST, () => {
    console.log(`Backend listening on ${HOST}:${PORT}`);
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
}

void startServer().catch((error) => {
  console.error("Backend startup failed:", error);
  process.exitCode = 1;
});
