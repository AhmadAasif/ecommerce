import { Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcrypt";
import pool from "../config/database.js";

/**
 * One-time bootstrap for the first admin.
 * It is available only while ADMIN_SETUP_SECRET is configured and no admin exists.
 * Remove ADMIN_SETUP_SECRET from the deployment environment after creating the first admin.
 */
export const setupFirstAdmin = async (req: Request, res: Response) => {
  const configuredSecret = process.env.ADMIN_SETUP_SECRET;
  if (!configuredSecret || configuredSecret.length < 32) {
    res.status(404).json({ success: false, message: "Admin setup is disabled." });
    return;
  }

  const suppliedSecret = req.body?.setupSecret;
  if (typeof suppliedSecret !== "string") {
    res.status(401).json({ success: false, message: "Invalid setup credentials." });
    return;
  }

  const expected = Buffer.from(configuredSecret, "utf8");
  const supplied = Buffer.from(suppliedSecret, "utf8");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    res.status(401).json({ success: false, message: "Invalid setup credentials." });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body?.password;

  if (name.length < 2 || name.length > 100) {
    res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters." });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    res.status(400).json({ success: false, message: "Enter a valid email address." });
    return;
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    res.status(400).json({ success: false, message: "Password must be between 12 and 128 characters." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize concurrent setup attempts so two requests cannot both create the first admin.
    await client.query("SELECT pg_advisory_xact_lock($1)", [764281903]);
    const existing = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ success: false, message: "An admin account already exists. Use the admin login instead." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await client.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id, name, email, role",
      [name, email, passwordHash]
    );
    await client.query("COMMIT");
    res.status(201).json({
      success: true,
      message: "First admin created. Remove ADMIN_SETUP_SECRET from the backend environment now.",
      data: { admin: created.rows[0] }
    });
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error?.code === "23505") {
      res.status(409).json({ success: false, message: "That email address is already registered." });
      return;
    }
    console.error("First admin setup failed:", error);
    res.status(500).json({ success: false, message: "Unable to create the admin account." });
  } finally {
    client.release();
  }
};
