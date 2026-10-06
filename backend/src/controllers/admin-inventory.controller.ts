import { Request, Response } from "express";
import pool from "../config/database.js";

export const getInventory = async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const lowStock = req.query.lowStock === "true";
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(p.name ILIKE $1 OR pv.sku ILIKE $1 OR COALESCE(pv.size, '') ILIKE $1 OR COALESCE(pv.color, '') ILIKE $1)`);
    }
    if (lowStock) conditions.push("pv.stock_quantity <= 5");

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT pv.id AS variant_id, p.id AS product_id, p.name AS product_name,
              pv.sku, pv.size, pv.color, pv.stock_quantity, pv.status,
              GREATEST(pv.stock_quantity - COALESCE((
                SELECT SUM(r.quantity) FROM order_inventory_reservations r
                WHERE r.variant_id = pv.id AND r.status = 'reserved'
                AND r.expires_at > CURRENT_TIMESTAMP
              ), 0), 0) AS available_stock
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       ${where}
       ORDER BY p.name ASC, pv.id ASC`,
      values
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error("Get inventory error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch inventory" });
  }
};

export const updateInventory = async (req: Request, res: Response) => {
  try {
    const variantId = Number(req.params.variantId);
    const stockQuantity = Number(req.body.stockQuantity);

    if (!Number.isInteger(variantId) || variantId <= 0 || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      res.status(400).json({ success: false, message: "Valid variant ID and non-negative integer stock quantity are required" }); return;
    }

    const reservedResult = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS reserved_quantity
       FROM order_inventory_reservations
       WHERE variant_id = $1 AND status = 'reserved' AND expires_at > CURRENT_TIMESTAMP`,
      [variantId]
    );
    const reserved = Number(reservedResult.rows[0].reserved_quantity);

    if (stockQuantity < reserved) {
      res.status(400).json({
        success: false,
        message: `Stock cannot be lower than currently reserved quantity (${reserved})`,
        reservedStock: reserved
      });
      return;
    }

    const result = await pool.query(
      `UPDATE product_variants
       SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, product_id, sku, size, color, stock_quantity, status`,
      [stockQuantity, variantId]
    );
    if (!result.rows.length) { res.status(404).json({ success: false, message: "Inventory item not found" }); return; }
    res.json({ success: true, message: "Inventory updated successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Update inventory error:", error);
    res.status(500).json({ success: false, message: "Failed to update inventory" });
  }
};
