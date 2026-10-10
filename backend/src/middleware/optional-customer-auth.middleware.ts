import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest } from "./auth.middleware.js";

/** Attach a valid customer identity when supplied; preserve guest checkout. */
export function optionalCustomerAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) { next(); return; }
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) { next(); return; }
  try {
    const payload = jwt.verify(token, secret) as { id: number; email: string; role: "admin" | "customer" };
    if (payload.role === "customer") req.user = payload;
  } catch {
    // A stale optional token must not prevent a guest from checking out.
  }
  next();
}
