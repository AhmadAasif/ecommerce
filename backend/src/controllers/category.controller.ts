import { Request, Response } from "express";
import pool from "../config/database.js";

export const getCategories = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description, image_url, created_at
      FROM categories
      ORDER BY name ASC
    `);

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
};