import bcrypt from "bcrypt";
import pool from "../../src/config/database.js";
import "dotenv/config";

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before running this script.");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters long.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin') " +
    "ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = 'admin', updated_at = CURRENT_TIMESTAMP " +
    "RETURNING id, name, email, role",
    [name, email, passwordHash]
  );
  console.log("Admin account ready:", result.rows[0].email);
}

main()
  .catch((error) => {
    console.error("Could not create admin account:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });