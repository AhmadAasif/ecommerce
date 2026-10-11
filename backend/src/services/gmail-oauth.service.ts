import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import pool from "../config/database.js";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const PROFILE_SCOPE = "openid email";
const STATE_TTL_SECONDS = 10 * 60;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function encryptionKey(): Buffer {
  const raw = requiredEnv("EMAIL_TOKEN_ENCRYPTION_KEY");
  let key: Buffer;
  if (/^[a-f0-9]{64}$/i.test(raw)) key = Buffer.from(raw, "hex");
  else key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("EMAIL_TOKEN_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex characters or base64.");
  }
  return key;
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string): string {
  const [ivPart, tagPart, ciphertextPart] = value.split(".");
  if (!ivPart || !tagPart || !ciphertextPart) throw new Error("Stored Gmail token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function getOAuthClient() {
  const client = new google.auth.OAuth2(
    requiredEnv("GOOGLE_CLIENT_ID"),
    requiredEnv("GOOGLE_CLIENT_SECRET"),
    requiredEnv("GOOGLE_REDIRECT_URI")
  );
  return client;
}

export function createGmailConnectUrl(adminId: number): string {
  const jwtSecret = requiredEnv("JWT_SECRET");
  const state = jwt.sign({ purpose: "connect-store-gmail", adminId }, jwtSecret, {
    expiresIn: STATE_TTL_SECONDS,
    issuer: "kvnem",
    audience: "kvnem-gmail-oauth"
  });
  return getOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: true,
    scope: [GMAIL_SEND_SCOPE, PROFILE_SCOPE],
    state
  });
}

export function verifyGmailOAuthState(state: string): { adminId: number } {
  const payload = jwt.verify(state, requiredEnv("JWT_SECRET"), {
    issuer: "kvnem",
    audience: "kvnem-gmail-oauth"
  }) as jwt.JwtPayload & { purpose?: string; adminId?: number };
  if (payload.purpose !== "connect-store-gmail" || !Number.isInteger(payload.adminId) || Number(payload.adminId) <= 0) {
    throw new Error("Invalid Gmail authorization state.");
  }
  return { adminId: Number(payload.adminId) };
}

export async function saveGmailConnection(input: {
  adminId: number;
  code: string;
}) {
  const oauth = getOAuthClient();
  const { tokens } = await oauth.getToken(input.code);
  if (!tokens.access_token) throw new Error("Google did not return an access token.");

  oauth.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth });
  const profile = await oauth2.userinfo.get();
  const email = profile.data.email?.trim().toLowerCase();
  if (!email || !profile.data.verified_email) {
    throw new Error("Google did not return a verified email address for this account.");
  }

  const existing = await pool.query(
    "SELECT email, refresh_token_encrypted FROM store_email_connection WHERE id = 1"
  );
  // Reuse a refresh token only when reconnecting the same Google account.
  const previousRefreshToken = existing.rows[0]?.email === email
    ? existing.rows[0]?.refresh_token_encrypted as string | undefined
    : undefined;
  const refreshToken = tokens.refresh_token
    ? encrypt(tokens.refresh_token)
    : previousRefreshToken ?? null;
  if (!refreshToken) {
    throw new Error("Google did not provide a refresh token. Disconnect the app from your Google Account and connect again.");
  }

  await pool.query(
    `INSERT INTO store_email_connection
      (id, email, access_token_encrypted, refresh_token_encrypted, token_expiry, connected_by_admin_id, connected_at, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       access_token_encrypted = EXCLUDED.access_token_encrypted,
       refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
       token_expiry = EXCLUDED.token_expiry,
       connected_by_admin_id = EXCLUDED.connected_by_admin_id,
       connected_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`,
    [
      email,
      encrypt(tokens.access_token),
      refreshToken,
      tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      input.adminId
    ]
  );
  return { email };
}

export async function getGmailConnectionStatus() {
  const result = await pool.query(
    "SELECT email, connected_at, updated_at FROM store_email_connection WHERE id = 1"
  );
  if (!result.rows[0]) return { connected: false, email: null, connectedAt: null };
  return {
    connected: true,
    email: result.rows[0].email as string,
    connectedAt: result.rows[0].connected_at,
    updatedAt: result.rows[0].updated_at
  };
}

export async function disconnectGmailConnection() {
  await pool.query("DELETE FROM store_email_connection WHERE id = 1");
}

export async function sendGmailMessage(input: {
  to: string;
  subject: string;
  html: string;
}) {
  const result = await pool.query(
    "SELECT email, access_token_encrypted, refresh_token_encrypted, token_expiry FROM store_email_connection WHERE id = 1"
  );
  const connection = result.rows[0];
  if (!connection) {
    console.info("Customer email skipped: no store Gmail account is connected.");
    return false;
  }

  const oauth = getOAuthClient();
  oauth.setCredentials({
    access_token: decrypt(connection.access_token_encrypted as string),
    refresh_token: decrypt(connection.refresh_token_encrypted as string),
    expiry_date: connection.token_expiry ? new Date(connection.token_expiry as string).getTime() : undefined
  });
  const gmail = google.gmail({ version: "v1", auth: oauth });

  const from = (process.env.STORE_NAME || "ecommerce").trim() || "ecommerce";
  const encodedSubject = `=?UTF-8?B?${Buffer.from(input.subject, "utf8").toString("base64")}?=`;
  const message = [
    `From: ${from.replace(/[\r\n"]/g, "")} <${connection.email}>`,
    `To: ${input.to.replace(/[\r\n]/g, "")}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html
  ].join("\r\n");
  const raw = Buffer.from(message, "utf8").toString("base64url");
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return true;
}
