import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha YYYY-MM-DD");

export const RangeQuerySchema = z.object({
  hotel_id: z.string().uuid("El hotel_id debe ser un UUID válido"),
  from: isoDate,
  to: isoDate,
});

export const ForecastQuerySchema = RangeQuerySchema.extend({
  horizon: z.coerce.number().int().min(1).max(90).default(14),
});

export const DashboardParamsSchema = z.object({
  hotelId: z.string().uuid("El hotelId debe ser un UUID válido"),
});

/** El dashboard recibe hotelId por path, así que el query no lo repite. */
export const DashboardQuerySchema = RangeQuerySchema.omit({ hotel_id: true });
