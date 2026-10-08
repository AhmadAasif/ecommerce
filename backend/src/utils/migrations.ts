import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pool from "../config/database.js";

/** Apply SQL migrations in order and record each successful file. */
export async function runMigrations() {
  const directory = path.resolve(process.cwd(), "database", "migrations");
  const files = (await readdir(directory))
    .filter((file) => /^\d+.*\.sql$/i.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)");

  for (const file of files) {
    const alreadyApplied = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (alreadyApplied.rowCount) continue;
    const sql = await readFile(path.join(directory, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log("Database migration applied: " + file);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Database migration failed: " + file, error);
      throw error;
    } finally {
      client.release();
    }
  }
  console.log("Database migrations checked (" + files.length + " file(s)).");
}