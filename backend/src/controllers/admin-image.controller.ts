import { Request, Response } from "express";
import pool from "../config/database.js";
import cloudinary from "../config/cloudinary.js";

interface MulterRequest extends Request { file?: Express.Multer.File; }

export const uploadProductImage = async (req: MulterRequest, res: Response) => {
  try {
    const { productId } = req.params;
    if (!req.file) { res.status(400).json({success:false,message:"Image file is required"}); return; }

    const productResult = await pool.query("SELECT id FROM products WHERE id=$1", [productId]);
    if (!productResult.rows.length) { res.status(404).json({success:false,message:"Product not found"}); return; }

    const uploadResult = await new Promise<any>((resolve,reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder:"ecommerce/products", resource_type:"image" },
        (error,result) => error ? reject(error) : resolve(result)
      );
      stream.end(req.file!.buffer);
    });

    const existing = await pool.query("SELECT id FROM product_images WHERE product_id=$1 LIMIT 1", [productId]);
    const imageResult = await pool.query(`
      INSERT INTO product_images (product_id,image_url,is_primary)
      VALUES ($1,$2,$3)
      RETURNING id,product_id,image_url,is_primary,created_at
    `, [productId,uploadResult.secure_url,existing.rows.length===0]);

    res.status(201).json({success:true,message:"Product image uploaded successfully",data:imageResult.rows[0]});
  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({success:false,message:"Failed to upload product image"});
  }
};