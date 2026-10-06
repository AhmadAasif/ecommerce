import { Request, Response } from "express";
import pool from "../config/database.js";

export const createVariant = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { sku,size,color,price,stockQuantity,status } = req.body;
    if (!sku) { res.status(400).json({success:false,message:"SKU is required"}); return; }

    const result = await pool.query(`
      INSERT INTO product_variants (product_id,sku,size,color,price,stock_quantity,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id,product_id,sku,size,color,price,stock_quantity,status
    `, [productId,sku,size||null,color||null,price!==undefined?Number(price):null,Number(stockQuantity||0),status||"active"]);

    res.status(201).json({success:true,message:"Variant created successfully",data:result.rows[0]});
  } catch (error) {
    console.error(error);
    res.status(500).json({success:false,message:"Failed to create variant"});
  }
};

export const updateVariant = async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;
    const { sku,size,color,price,stockQuantity,status } = req.body;
    const result = await pool.query(`
      UPDATE product_variants SET sku=$1,size=$2,color=$3,price=$4,stock_quantity=$5,status=$6,updated_at=CURRENT_TIMESTAMP
      WHERE id=$7
      RETURNING id,product_id,sku,size,color,price,stock_quantity,status
    `, [sku,size||null,color||null,price!==undefined?Number(price):null,Number(stockQuantity||0),status||"active",variantId]);

    if (!result.rows.length) { res.status(404).json({success:false,message:"Variant not found"}); return; }
    res.json({success:true,message:"Variant updated successfully",data:result.rows[0]});
  } catch (error) { console.error(error); res.status(500).json({success:false,message:"Failed to update variant"}); }
};

export const deleteVariant = async (req: Request, res: Response) => {
  try {
    const result = await pool.query("DELETE FROM product_variants WHERE id=$1 RETURNING id", [req.params.variantId]);
    if (!result.rows.length) { res.status(404).json({success:false,message:"Variant not found"}); return; }
    res.json({success:true,message:"Variant deleted successfully"});
  } catch (error) { console.error(error); res.status(500).json({success:false,message:"Failed to delete variant"}); }
};