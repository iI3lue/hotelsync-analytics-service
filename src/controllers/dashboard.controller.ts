import { Request, Response, NextFunction } from "express";
import { dashboard } from "../services/analytics.service";

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hotelId } = req.params;
    const { from, to } = req.query as unknown as { from: string; to: string };
    res.json({ data: await dashboard(hotelId, { from, to }) });
  } catch (error) {
    next(error);
  }
};
