import { Request, Response } from "express";
import pool from "../config/database.js";

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, description, price, discount, categoryId, brand, status, gender } = req.body;
    if (!name || price === undefined) { res.status(400).json({success:false,message:"Product name and price are required"}); return; }
    if (gender !== undefined && !["men", "women"].includes(String(gender).toLowerCase())) { res.status(400).json({success:false,message:"Gender must be men or women"}); return; }
    if (Number(price) < 0) { res.status(400).json({success:false,message:"Price cannot be negative"}); return; }
    if (discount !== undefined && (Number(discount)<0 || Number(discount)>100)) { res.status(400).json({success:false,message:"Discount must be between 0 and 100"}); return; }

    const result = await pool.query(`
      INSERT INTO products (name,description,price,discount,category_id,brand,status,gender)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id,name,description,price,discount,category_id,brand,status,gender,created_at
    `, [name,description||null,Number(price),discount!==undefined?Number(discount):0,categoryId||null,brand||null,status||"active",gender ? String(gender).toLowerCase() : null]);

    res.status(201).json({success:true,message:"Product created successfully",data:result.rows[0]});
  } catch (error) { console.error(error); res.status(500).json({success:false,message:"Failed to create product"}); }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name,description,price,discount,categoryId,brand,status,gender } = req.body;
    if (!name || price === undefined) { res.status(400).json({success:false,message:"Product name and price are required"}); return; }
    if ((gender !== undefined && !["men", "women"].includes(String(gender).toLowerCase())) || Number(price)<0 || (discount!==undefined && (Number(discount)<0 || Number(discount)>100))) { res.status(400).json({success:false,message:"Invalid price or discount"}); return; }

    const result = await pool.query(`
      UPDATE products SET name=$1,description=$2,price=$3,discount=$4,category_id=$5,brand=$6,status=$7,gender=$8,updated_at=CURRENT_TIMESTAMP
      WHERE id=$9
      RETURNING id,name,description,price,discount,category_id,brand,status,gender,updated_at
    `, [name,description||null,Number(price),discount!==undefined?Number(discount):0,categoryId||null,brand||null,status||"active",gender ? String(gender).toLowerCase() : null,id]);

    if (!result.rows.length) { res.status(404).json({success:false,message:"Product not found"}); return; }
    res.json({success:true,message:"Product updated successfully",data:result.rows[0]});
  } catch (error) { console.error(error); res.status(500).json({success:false,message:"Failed to update product"}); }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const result = await pool.query("DELETE FROM products WHERE id=$1 RETURNING id,name", [req.params.id]);
    if (!result.rows.length) { res.status(404).json({success:false,message:"Product not found"}); return; }
    res.json({success:true,message:"Product deleted successfully",data:result.rows[0]});
  } catch (error) { console.error(error); res.status(500).json({success:false,message:"Failed to delete product"}); }
};

export const getAdminProducts = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id, p.name, p.description, p.price, p.discount, p.brand, p.status,
        p.category_id, c.name AS category_name,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', pi.id, 'image_url', pi.image_url, 'is_primary', pi.is_primary
        )) FILTER (WHERE pi.id IS NOT NULL), '[]') AS images,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', pv.id, 'product_id', pv.product_id, 'sku', pv.sku,
          'size', pv.size, 'color', pv.color, 'price', pv.price,
          'stock_quantity', pv.stock_quantity, 'status', pv.status
        )) FILTER (WHERE pv.id IS NOT NULL), '[]') AS variants
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_images pi ON pi.product_id = p.id
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      GROUP BY p.id, c.name
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get admin products error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch admin products" });
  }
};
