import { Response } from "express";
import bcrypt from "bcrypt";
import pool from "../config/database.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const getAdminAccount = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role FROM users WHERE id = $1 AND role = 'admin'",
      [req.user?.id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ success: false, message: "Admin account not found." });
      return;
    }
    res.json({ success: true, data: { admin: result.rows[0] } });
  } catch (error) {
    console.error("Get admin account failed:", error);
    res.status(500).json({ success: false, message: "Unable to load admin account." });
  }
};

export const updateAdminAccount = async (req: AuthRequest, res: Response) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const currentPassword = req.body?.currentPassword;

  if (name.length < 2 || name.length > 100) {
    res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters." });
    return;
  }
  if (!validEmail(email) || email.length > 255) {
    res.status(400).json({ success: false, message: "Enter a valid email address." });
    return;
  }
  if (typeof currentPassword !== "string" || !currentPassword) {
    res.status(400).json({ success: false, message: "Current password is required to change account details." });
    return;
  }

  try {
    const current = await pool.query(
      "SELECT id, password_hash FROM users WHERE id = $1 AND role = 'admin'",
      [req.user?.id]
    );
    if (!current.rows[0] || !(await bcrypt.compare(currentPassword, current.rows[0].password_hash))) {
      res.status(401).json({ success: false, message: "Current password is incorrect." });
      return;
    }
    const updated = await pool.query(
      "UPDATE users SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND role = 'admin' RETURNING id, name, email, role",
      [name, email, req.user?.id]
    );
    res.json({ success: true, message: "Admin account updated.", data: { admin: updated.rows[0] } });
  } catch (error: any) {
    if (error?.code === "23505") {
      res.status(409).json({ success: false, message: "That email address is already in use." });
      return;
    }
    console.error("Update admin account failed:", error);
    res.status(500).json({ success: false, message: "Unable to update admin account." });
  }
};

export const changeAdminPassword = async (req: AuthRequest, res: Response) => {
  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;
  if (typeof currentPassword !== "string" || !currentPassword) {
    res.status(400).json({ success: false, message: "Current password is required." });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 128) {
    res.status(400).json({ success: false, message: "New password must be between 12 and 128 characters." });
    return;
  }

  try {
    const current = await pool.query(
      "SELECT id, password_hash FROM users WHERE id = $1 AND role = 'admin'",
      [req.user?.id]
    );
    if (!current.rows[0] || !(await bcrypt.compare(currentPassword, current.rows[0].password_hash))) {
      res.status(401).json({ success: false, message: "Current password is incorrect." });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND role = 'admin'",
      [passwordHash, req.user?.id]
    );
    res.json({ success: true, message: "Password changed. Sign in again with the new password." });
  } catch (error) {
    console.error("Change admin password failed:", error);
    res.status(500).json({ success: false, message: "Unable to change password." });
  }
};

export const createAdminAccount = async (req: AuthRequest, res: Response) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body?.password;

  if (name.length < 2 || name.length > 100) {
    res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters." });
    return;
  }
  if (!validEmail(email) || email.length > 255) {
    res.status(400).json({ success: false, message: "Enter a valid email address." });
    return;
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    res.status(400).json({ success: false, message: "Password must be between 12 and 128 characters." });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id, name, email, role",
      [name, email, passwordHash]
    );
    res.status(201).json({ success: true, message: "Admin account created.", data: { admin: result.rows[0] } });
  } catch (error: any) {
    if (error?.code === "23505") {
      res.status(409).json({ success: false, message: "That email address is already in use." });
      return;
    }
    console.error("Create admin account failed:", error);
    res.status(500).json({ success: false, message: "Unable to create admin account." });
  }
};
