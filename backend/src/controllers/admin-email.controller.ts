import { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
  createGmailConnectUrl,
  disconnectGmailConnection,
  getGmailConnectionStatus,
  saveGmailConnection,
  verifyGmailOAuthState
} from "../services/gmail-oauth.service.js";

export async function getAdminEmailStatus(_req: Request, res: Response) {
  try {
    res.json({ success: true, data: await getGmailConnectionStatus() });
  } catch (error) {
    console.error("Load Gmail connection status failed:", error);
    res.status(500).json({ success: false, message: "Unable to load email connection status." });
  }
}

export function startGmailConnection(req: AuthRequest, res: Response) {
  try {
    const adminId = req.user?.id;
    if (!adminId || req.user?.role !== "admin") {
      res.status(403).json({ success: false, message: "Admin access required." });
      return;
    }
    res.json({ success: true, data: { authorizationUrl: createGmailConnectUrl(adminId) } });
  } catch (error) {
    console.error("Start Gmail connection failed:", error);
    res.status(500).json({ success: false, message: "Gmail connection is not configured on the server yet." });
  }
}

export async function finishGmailConnection(req: Request, res: Response) {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const googleError = typeof req.query.error === "string" ? req.query.error : "";
  const frontend = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  const returnPage = frontend ? `${frontend}/admin` : "";

  if (googleError) {
    res.status(400).send("Gmail connection was cancelled or denied. Return to the KVNEM admin panel and try again.");
    return;
  }
  if (!code || !state) {
    res.status(400).send("Missing Google authorization code or state. Return to the KVNEM admin panel and try again.");
    return;
  }

  try {
    const { adminId } = verifyGmailOAuthState(state);
    const { email } = await saveGmailConnection({ adminId, code });
    const safeEmail = email.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
    res.status(200).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KVNEM Gmail connected</title></head><body style="font-family:Arial,sans-serif;max-width:560px;margin:12vh auto;padding:24px;color:#172033"><h1>Gmail connected successfully</h1><p>KVNEM customer emails can now be sent from <strong>${safeEmail}</strong>.</p><p>You can close this tab and return to the admin panel.${returnPage ? ` <a href="${returnPage.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">Return to KVNEM</a>.` : ""}</p></body></html>`);
  } catch (error) {
    console.error("Finish Gmail connection failed:", error);
    res.status(400).send("Unable to connect this Gmail account. Check the server configuration and Google OAuth settings, then try again from the KVNEM admin panel.");
  }
}

export async function disconnectAdminGmail(_req: Request, res: Response) {
  try {
    await disconnectGmailConnection();
    res.json({ success: true, message: "Store Gmail account disconnected." });
  } catch (error) {
    console.error("Disconnect Gmail failed:", error);
    res.status(500).json({ success: false, message: "Unable to disconnect the store Gmail account." });
  }
}
