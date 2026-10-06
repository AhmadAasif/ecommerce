import { Request, Response } from "express";
import pool from "../config/database.js";

export const getProducts = async (req: Request, res: Response) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const brand = typeof req.query.brand === "string" ? req.query.brand.trim() : "";
    const size = typeof req.query.size === "string" ? req.query.size.trim() : "";
    const color = typeof req.query.color === "string" ? req.query.color.trim() : "";
    const category = Number(req.query.category);
    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const offset = (page - 1) * limit;
    const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";

    const values: unknown[] = [];
    const conditions = ["p.status = 'active'"];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(
        p.name ILIKE $1 OR p.description ILIKE $1 OR p.brand ILIKE $1
        OR c.name ILIKE $1 OR EXISTS (
          SELECT 1 FROM product_variants sv
          WHERE sv.product_id = p.id
          AND (sv.sku ILIKE $1 OR sv.color ILIKE $1 OR sv.size ILIKE $1)
        )
      )`);
    }

    if (Number.isInteger(category) && category > 0) {
      values.push(category);
      conditions.push(`p.category_id = $${values.length}`);
    }

    if (Number.isFinite(minPrice) && minPrice >= 0) {
      values.push(minPrice);
      conditions.push(`p.price >= $${values.length}`);
    }

    if (Number.isFinite(maxPrice) && maxPrice >= 0) {
      values.push(maxPrice);
      conditions.push(`p.price <= $${values.length}`);
    }

    if (brand) {
      values.push(brand);
      conditions.push(`p.brand ILIKE $${values.length}`);
    }

    if (size) {
      values.push(size);
      conditions.push(`EXISTS (
        SELECT 1 FROM product_variants sv
        WHERE sv.product_id = p.id AND sv.status = 'active' AND sv.size ILIKE $${values.length}
      )`);
    }

    if (color) {
      values.push(color);
      conditions.push(`EXISTS (
        SELECT 1 FROM product_variants cv
        WHERE cv.product_id = p.id AND cv.status = 'active' AND cv.color ILIKE $${values.length}
      )`);
    }

    if (req.query.inStock === "true") {
      conditions.push(`EXISTS (
        SELECT 1 FROM product_variants iv
        WHERE iv.product_id = p.id
          AND iv.status = 'active'
          AND iv.stock_quantity > 0
      )`);
    }

    const where = conditions.join(" AND ");

    let orderBy = "p.created_at DESC";
    if (sort === "price_low") orderBy = "p.price ASC";
    if (sort === "price_high") orderBy = "p.price DESC";
    if (sort === "name") orderBy = "p.name ASC";
    if (sort === "discount") orderBy = "p.discount DESC, p.created_at DESC";

    const countResult = await pool.query(
      `SELECT COUNT(*)::INTEGER AS total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${where}`,
      values
    );

    const dataValues = [...values, limit, offset];
    const result = await pool.query(
      `SELECT
         p.id, p.name, p.description, p.price, p.discount, p.brand, p.status,
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
       LEFT JOIN product_variants pv ON p.id = pv.product_id AND pv.status = 'active'
       WHERE ${where}
       GROUP BY p.id, c.name
       ORDER BY ${orderBy}
       LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
      dataValues
    );

    const total = Number(countResult.rows[0].total);
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1
      },
      filters: { search, category: Number.isInteger(category) && category > 0 ? category : null, brand, size, color, minPrice: Number.isFinite(minPrice) ? minPrice : null, maxPrice: Number.isFinite(maxPrice) ? maxPrice : null, inStock: req.query.inStock === "true", sort }
    });
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
