import { Request, Response, NextFunction } from "express";
import { forecast, kpiSeries, occupancySeries } from "../services/analytics.service";

export const getOccupancy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hotel_id, from, to } = req.query as unknown as { hotel_id: string; from: string; to: string };
    res.json({ data: await occupancySeries(hotel_id, { from, to }) });
  } catch (error) {
    next(error);
  }
};

export const getAdr = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hotel_id, from, to } = req.query as unknown as { hotel_id: string; from: string; to: string };
    const rows = await kpiSeries(hotel_id, { from, to });
    res.json({ data: rows.map((r) => ({ hotel_id: r.hotel_id, date: r.date, adr: r.adr })) });
  } catch (error) {
    next(error);
  }
};

export const getRevpar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hotel_id, from, to } = req.query as unknown as { hotel_id: string; from: string; to: string };
    const rows = await kpiSeries(hotel_id, { from, to });
    res.json({ data: rows.map((r) => ({ hotel_id: r.hotel_id, date: r.date, revpar: r.revpar })) });
  } catch (error) {
    next(error);
  }
};

export const getForecast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hotel_id, from, to, horizon } = req.query as unknown as {
      hotel_id: string;
      from: string;
      to: string;
      horizon: number;
    };
    res.json({ data: await forecast(hotel_id, { from, to }, horizon) });
  } catch (error) {
    next(error);
  }
};
