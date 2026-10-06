import { Request, Response } from "express";
import pool from "../config/database.js";

export const createCategory = async (req: Request, res: Response) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : null;
    const imageUrl = typeof req.body.imageUrl === "string" ? req.body.imageUrl.trim() : null;
    if (!name) { res.status(400).json({ success: false, message: "Category name is required" }); return; }

    const result = await pool.query(
      `INSERT INTO categories (name, description, image_url) VALUES ($1, $2, $3)
       RETURNING id, name, description, image_url, created_at`,
      [name, description || null, imageUrl || null]
    );
    res.status(201).json({ success: true, message: "Category created successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Create category error:", error);
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ success: false, message: "Category name already exists" }); return;
    }
    res.status(500).json({ success: false, message: "Failed to create category" });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const categoryId = Number(req.params.id);
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : null;
    const imageUrl = typeof req.body.imageUrl === "string" ? req.body.imageUrl.trim() : null;
    if (!Number.isInteger(categoryId) || categoryId <= 0 || !name) {
      res.status(400).json({ success: false, message: "Valid category ID and name are required" }); return;
    }

    const result = await pool.query(
      `UPDATE categories SET name = $1, description = $2, image_url = $3 WHERE id = $4
       RETURNING id, name, description, image_url, created_at`,
      [name, description || null, imageUrl || null, categoryId]
    );
    if (!result.rows.length) { res.status(404).json({ success: false, message: "Category not found" }); return; }
    res.json({ success: true, message: "Category updated successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Update category error:", error);
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ success: false, message: "Category name already exists" }); return;
    }
    res.status(500).json({ success: false, message: "Failed to update category" });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const categoryId = Number(req.params.id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      res.status(400).json({ success: false, message: "Invalid category ID" }); return;
    }
    const result = await pool.query("DELETE FROM categories WHERE id = $1 RETURNING id", [categoryId]);
    if (!result.rows.length) { res.status(404).json({ success: false, message: "Category not found" }); return; }
    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ success: false, message: "Failed to delete category" });
  }
};
