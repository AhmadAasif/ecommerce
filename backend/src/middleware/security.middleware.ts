import { NextFunction, Request, Response } from "express";

const requests = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

export const requestRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const current = requests.get(ip);

  if (!current || current.resetAt <= now) {
    requests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  current.count += 1;

  if (current.count > MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please try again later."
    });
    return;
  }

  next();
};

export const cleanupRateLimitStore = () => {
  const now = Date.now();
  for (const [ip, entry] of requests.entries()) {
    if (entry.resetAt <= now) requests.delete(ip);
  }
};
