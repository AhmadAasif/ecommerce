import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

interface AuthPayload { id: number; email: string; role: "admin" | "customer"; }
export interface AuthRequest extends Request { user?: AuthPayload; }

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) { res.status(401).json({ success:false, message:"Authentication required" }); return; }

    const token = authHeader.split(" ")[1];
    if (!token) { res.status(401).json({ success:false, message:"Invalid authorization format" }); return; }

    const secret = process.env.JWT_SECRET;
    if (!secret) { res.status(500).json({ success:false, message:"Server configuration error" }); return; }

    req.user = jwt.verify(token, secret) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ success:false, message:"Invalid or expired token" });
  }
};