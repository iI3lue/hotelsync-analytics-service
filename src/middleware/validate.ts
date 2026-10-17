import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";

export const validate = (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
        return;
      }
      next(error);
    }
  };

/** Misma idea que `validate`, pero sobre `req.query` (endpoints GET). */
export const validateQuery = (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
        return;
      }
      next(error);
    }
  };

/** Valida `req.params` (endpoints con path params, ej. /:hotelId). */
export const validateParams = (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = (await schema.parseAsync(req.params)) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: "Validation failed", details: error.errors });
        return;
      }
      next(error);
    }
  };
