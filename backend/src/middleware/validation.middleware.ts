import { NextFunction, Request, Response } from "express";

type Rule = {
  field: string;
  type: "string" | "number" | "email";
  required?: boolean;
  minLength?: number;
};

export const validateBody = (rules: Rule[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body?.[rule.field];

      if (
        rule.required &&
        (value === undefined || value === null || value === "")
      ) {
        errors.push(`${rule.field} is required`);
        continue;
      }

      if (value === undefined || value === null || value === "") continue;

      if (rule.type === "string" && typeof value !== "string") {
        errors.push(`${rule.field} must be a string`);
        continue;
      }

      if (rule.type === "number" && !Number.isFinite(Number(value))) {
        errors.push(`${rule.field} must be a number`);
        continue;
      }

      if (rule.type === "email") {
        if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push(`${rule.field} must be a valid email`);
          continue;
        }
      }

      if (
        rule.minLength &&
        typeof value === "string" &&
        value.trim().length < rule.minLength
      ) {
        errors.push(`${rule.field} must contain at least ${rule.minLength} characters`);
      }
    }

    if (errors.length) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
      });
      return;
    }

    next();
  };
};
