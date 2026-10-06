import { Request, Response } from "express";
import pool from "../config/database.js";

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, description, price, discount, categoryId, brand, status } = req.body;
    if (!name || price === undefined) { res.status(400).json({success:false,message:"Product name and price are required"}); return; }
    if (Number(price) < 0) { res.status(400).json({success:false,message:"Price cannot be negative"}); return; }
    if (discount !== undefined && (Number(discount)<0 || Number(discount)>100)) { res.status(400).json({success:false,message:"Discount must be between 0 and 100"}); return; }

    const result = await pool.query(`
      INSERT INTO products (name,description,price,discount,category_id,brand,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id,name,description,price,discount,category_id,brand,status,created_at
    `, [name,description||null,Number(price),discount!==undefined?Number(discount):0,categoryId||null,brand||null,status||"active"]);

    res.status(201).json({success:true,message:"Product created successfully",data:result.rows[0]});
  } catch (error) { console.error(error); res.status(500).json({success:false,message:"Failed to create product"}); }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name,description,price,discount,categoryId,brand,status } = req.body;
    if (!name || price === undefined) { res.status(400).json({success:false,message:"Product name and price are required"}); return; }
    if (Number(price)<0 || (discount!==undefined && (Number(discount)<0 || Number(discount)>100))) { res.status(400).json({success:false,message:"Invalid price or discount"}); return; }

    const result = await pool.query(`
      UPDATE products SET name=$1,description=$2,price=$3,discount=$4,category_id=$5,brand=$6,status=$7,updated_at=CURRENT_TIMESTAMP
      WHERE id=$8
      RETURNING id,name,description,price,discount,category_id,brand,status,updated_at
    `, [name,description||null,Number(price),discount!==undefined?Number(discount):0,categoryId||null,brand||null,status||"active",id]);

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