import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ success:false, message:"Email and password are required" }); return; }

    const result = await pool.query(`
      SELECT id, name, email, password_hash, role FROM users
      WHERE email = $1 AND role = 'admin'
    `, [email]);

    if (result.rows.length === 0 || !(await bcrypt.compare(password, result.rows[0].password_hash))) {
      res.status(401).json({ success:false, message:"Invalid email or password" }); return;
    }

    const admin = result.rows[0];
    const secret = process.env.JWT_SECRET;
    if (!secret) { res.status(500).json({ success:false, message:"Server configuration error" }); return; }

    const token = jwt.sign({ id:admin.id, email:admin.email, role:admin.role }, secret, { expiresIn:"1d" });
    res.json({
      success:true, message:"Admin login successful",
      data:{ token, admin:{ id:admin.id, name:admin.name, email:admin.email, role:admin.role } }
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ success:false, message:"Login failed" });
  }
};