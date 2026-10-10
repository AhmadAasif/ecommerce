import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";
import { AuthRequest } from "../middleware/auth.middleware.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function issueToken(id: number, email: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign({ id, email, role: "customer" }, secret, { expiresIn: "7d" });
}
function publicCustomer(row: any) {
  return { id: row.id, name: row.name, email: row.email, role: "customer" };
}

export async function registerCustomer(req: Request, res: Response) {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (name.length < 2 || name.length > 150 || !emailPattern.test(email) || password.length < 12 || password.length > 128) {
    res.status(400).json({ success: false, message: "Enter a valid name and email, and a password of 12–128 characters." }); return;
  }
  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount) { res.status(409).json({ success: false, message: "An account with this email already exists." }); return; }
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'customer') RETURNING id, name, email, role",
      [name, email, hash]
    );
    const customer = publicCustomer(result.rows[0]);
    res.status(201).json({ success: true, data: { customer, token: issueToken(customer.id, customer.email) } });
  } catch (error) {
    console.error("Customer registration failed:", error);
    res.status(500).json({ success: false, message: "Could not create your account." });
  }
}

export async function loginCustomer(req: Request, res: Response) {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!emailPattern.test(email) || !password) { res.status(400).json({ success: false, message: "Email and password are required." }); return; }
  try {
    const result = await pool.query("SELECT id, name, email, password_hash, role FROM users WHERE email = $1 AND role = 'customer'", [email]);
    const row = result.rows[0];
    if (!row || !row.password_hash || !(await bcrypt.compare(password, row.password_hash))) {
      res.status(401).json({ success: false, message: "Invalid email or password." }); return;
    }
    const customer = publicCustomer(row);
    res.json({ success: true, data: { customer, token: issueToken(customer.id, customer.email) } });
  } catch (error) {
    console.error("Customer login failed:", error);
    res.status(500).json({ success: false, message: "Could not sign in." });
  }
}

export async function googleCustomerLogin(req: Request, res: Response) {
  const credential = typeof req.body.credential === "string" ? req.body.credential : "";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) { res.status(503).json({ success: false, message: "Google login is not configured." }); return; }
  if (!credential || credential.length > 10000) { res.status(400).json({ success: false, message: "Google credential is required." }); return; }
  try {
    const response = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
    if (!response.ok) { res.status(401).json({ success: false, message: "Google sign-in could not be verified." }); return; }
    const claims: any = await response.json();
    if (claims.aud !== clientId || claims.email_verified !== "true" || !emailPattern.test(String(claims.email || ""))) {
      res.status(401).json({ success: false, message: "Google account verification failed." }); return;
    }
    const email = String(claims.email).toLowerCase();
    const name = String(claims.name || claims.given_name || "Customer").trim().slice(0, 150);
    let result = await pool.query("SELECT id, name, email, role FROM users WHERE email = $1", [email]);
    if (result.rowCount && result.rows[0].role !== "customer") {
      res.status(409).json({ success: false, message: "This email is reserved for a store administrator." }); return;
    }
    if (!result.rowCount) {
      result = await pool.query("INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, NULL, 'customer') RETURNING id, name, email, role", [name || "Customer", email]);
    }
    const customer = publicCustomer(result.rows[0]);
    res.json({ success: true, data: { customer, token: issueToken(customer.id, customer.email) } });
  } catch (error) {
    console.error("Google customer login failed:", error);
    res.status(500).json({ success: false, message: "Google sign-in failed." });
  }
}

export async function getCustomerProfile(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== "customer") { res.status(403).json({ success: false, message: "Customer account required." }); return; }
    const result = await pool.query("SELECT id, name, email, role FROM users WHERE id = $1 AND role = 'customer'", [req.user.id]);
    if (!result.rowCount) { res.status(404).json({ success: false, message: "Account not found." }); return; }
    res.json({ success: true, data: { customer: publicCustomer(result.rows[0]) } });
  } catch (error) {
    console.error("Customer profile failed:", error);
    res.status(500).json({ success: false, message: "Could not load account." });
  }
}

export async function getCustomerOrders(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== "customer") { res.status(403).json({ success: false, message: "Customer account required." }); return; }
    const result = await pool.query(
      "SELECT id, order_number, total_amount, payment_status, order_status, created_at, updated_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
      [req.user.id]
    );
    const orders = await Promise.all(result.rows.map(async (order: any) => {
      const [items, history] = await Promise.all([
        pool.query("SELECT product_name, size, color, quantity, unit_price, total_price FROM order_items WHERE order_id = $1 ORDER BY id", [order.id]),
        pool.query("SELECT status, note, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC, id ASC", [order.id])
      ]);
      return { ...order, items: items.rows, statusHistory: history.rows };
    }));
    res.json({ success: true, data: { orders } });
  } catch (error) {
    console.error("Customer orders failed:", error);
    res.status(500).json({ success: false, message: "Could not load order history." });
  }
}
