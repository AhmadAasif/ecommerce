import { Request, Response } from "express";
import pool from "../config/database.js";

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { search, category, minPrice, maxPrice, sort } = req.query;

    let query = `
      SELECT p.id, p.name, p.description, p.price, p.discount, p.brand, p.status,
             p.category_id, c.name AS category_name,
             COALESCE(json_agg(DISTINCT jsonb_build_object(
               'id', pi.id, 'imageUrl', pi.image_url, 'isPrimary', pi.is_primary
             )) FILTER (WHERE pi.id IS NOT NULL), '[]') AS images,
             COALESCE(json_agg(DISTINCT jsonb_build_object(
               'id', pv.id, 'sku', pv.sku, 'size', pv.size, 'color', pv.color,
               'price', pv.price, 'stock', pv.stock_quantity, 'status', pv.status
             )) FILTER (WHERE pv.id IS NOT NULL), '[]') AS variants
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_images pi ON p.id = pi.product_id
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      WHERE p.status = 'active'
    `;

    const values: unknown[] = [];
    let parameterIndex = 1;

    if (search) {
      query += ` AND (p.name ILIKE $${parameterIndex} OR p.description ILIKE $${parameterIndex})`;
      values.push(`%${search}%`);
      parameterIndex++;
    }
    if (category) {
      query += ` AND p.category_id = $${parameterIndex}`;
      values.push(Number(category));
      parameterIndex++;
    }
    if (minPrice) {
      query += ` AND p.price >= $${parameterIndex}`;
      values.push(Number(minPrice));
      parameterIndex++;
    }
    if (maxPrice) {
      query += ` AND p.price <= $${parameterIndex}`;
      values.push(Number(maxPrice));
      parameterIndex++;
    }

    query += ` GROUP BY p.id, c.name`;

    switch (sort) {
      case "price_low": query += " ORDER BY p.price ASC"; break;
      case "price_high": query += " ORDER BY p.price DESC"; break;
      case "name": query += " ORDER BY p.name ASC"; break;
      default: query += " ORDER BY p.created_at DESC";
    }

    const result = await pool.query(query, values);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const productResult = await pool.query(`
      SELECT p.id, p.name, p.description, p.price, p.discount, p.brand, p.status,
             p.category_id, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1 AND p.status = 'active'
    `, [id]);

    if (productResult.rows.length === 0) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }

    const imagesResult = await pool.query(`
      SELECT id, image_url, is_primary FROM product_images
      WHERE product_id = $1 ORDER BY is_primary DESC, id ASC
    `, [id]);

    const variantsResult = await pool.query(`
      SELECT id, sku, size, color, price, stock_quantity, status
      FROM product_variants
      WHERE product_id = $1 AND status = 'active' ORDER BY id ASC
    `, [id]);

    res.json({
      success: true,
      data: { ...productResult.rows[0], images: imagesResult.rows, variants: variantsResult.rows }
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ success: false, message: "Failed to fetch product" });
  }
};