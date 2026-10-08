import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool(
  connectionString
    ? {
        connectionString,
        // Managed PostgreSQL providers such as Render require TLS for external
        // connections. Internal Render connections may also use this setting.
        ssl: isProduction ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10
      }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || "ecommerce_db",
        ssl: isProduction ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 10
      }
);

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

export default pool;
