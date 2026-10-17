import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "./error-handler";

export interface AuthUser {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError(401, "Unauthorized", "Token missing"));
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.AUTH_JWT_SECRET!) as any;
    req.user = { userId: decoded.userId || decoded.sub, role: decoded.role || "GUEST" };
    next();
  } catch (error) {
    next(new AppError(401, "Unauthorized", "Invalid token"));
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "Unauthorized", "Not authenticated"));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "Forbidden", "Insufficient permissions"));
    }
    next();
  };
};
