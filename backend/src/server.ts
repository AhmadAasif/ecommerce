import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/database.js";

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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

app.get("/api/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      success: true,
      message: "E-commerce backend is running",
      database: "connected",
      databaseTime: result.rows[0].now
    });
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});