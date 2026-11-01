import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "./error-handler";

export interface AuthUser {
  userId: string;
  role: string;
  hotel_id: string | null;
  scope: "global" | "hotel";
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
    const hotelId = typeof decoded.hotel_id === "string" ? decoded.hotel_id : null;
    req.user = {
      userId: decoded.userId || decoded.sub,
      role: decoded.role || "GUEST",
      hotel_id: hotelId,
      scope: decoded.scope === "global" || decoded.scope === "hotel"
        ? decoded.scope
        : hotelId
          ? "hotel"
          : "global",
    };
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

/**
 * Aísla los datos por hotel: un MANAGER solo puede consultar el hotel de su
 * asignación. SUPER_ADMIN conserva visión global. Se aplica después de que el
 * borde validó el `hotelId`/`hotel_id`, por lo que siempre está presente.
 */
export const requireHotelScope = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError(401, "Unauthorized", "Not authenticated"));
  }
  if (req.user.role === "SUPER_ADMIN") return next();

  const requested =
    typeof req.params.hotelId === "string"
      ? req.params.hotelId
      : typeof req.query.hotel_id === "string"
        ? req.query.hotel_id
        : null;

  if (!requested) {
    return next(new AppError(400, "hotel_id is required", "Bad Request"));
  }
  if (!req.user.hotel_id || requested.toLowerCase() !== req.user.hotel_id.toLowerCase()) {
    return next(new AppError(403, "Forbidden", "Hotel scope mismatch"));
  }
  next();
};
