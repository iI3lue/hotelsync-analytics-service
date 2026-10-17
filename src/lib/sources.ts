import { PrismaClient } from "@prisma/client";

/**
 * Acceso a las réplicas de SOLO LECTURA de booking y property.
 * Se usa `$queryRawUnsafe` (sin modelos) a propósito: este servicio jamás
 * migra ni escribe esas bases. En producción, las URLs usan usuarios
 * read-only. Los parámetros van como placeholders ($1, $2) y ya vienen
 * validados por Zod (YYYY-MM-DD): nunca se interpola texto en el SQL.
 */

function replica(url: string | undefined, name: string): PrismaClient {
  if (!url) throw new Error(`Falta ${name} (.env)`);
  return new PrismaClient({ datasources: { db: { url } } });
}

export const bookingReplica = () =>
  replica(process.env.DATABASE_URL_BOOKING, "DATABASE_URL_BOOKING");

export const propertyReplica = () =>
  replica(process.env.DATABASE_URL_PROPERTY, "DATABASE_URL_PROPERTY");

export interface OccupiedNightRow {
  hotel_id: string;
  night: string;
  occupied: number;
  revenue: string | number;
}

/**
 * Noches ocupadas + ingreso imputado por noche, por hotel.
 * Verificado contra `services/booking-service/prisma/schema.prisma`:
 *   - `status`: pending → confirmed | cancelled. `confirmed` es el estado
 *     final del booking (la reserva no pasa a "completed"), por eso el filtro.
 *   - `check_in`/`check_out` son `date`: la resta da noches (entero).
 * El ingreso se prorratea entre las noches de la estadía
 * (`total_amount / noches`) para no contar la tarifa completa en cada noche,
 * lo que inflaría ADR y RevPAR.
 *
 * `night` va con `::text` a propósito: Prisma mapea las columnas `date` de un
 * raw query a objetos `Date`, y el contrato de este agregado es `YYYY-MM-DD`.
 */
export async function occupiedNights(
  db: PrismaClient,
  from: string,
  to: string
): Promise<OccupiedNightRow[]> {
  return db.$queryRawUnsafe<OccupiedNightRow[]>(
    `SELECT hotel_id, d::date::text AS night, COUNT(*)::int AS occupied,
            COALESCE(SUM(total_amount / GREATEST(check_out - check_in, 1)), 0) AS revenue
       FROM bookings, generate_series($1::date, ($2::date - INTERVAL '1 day'), '1 day') AS d
      WHERE status = 'confirmed'
        AND check_in <= d AND check_out > d
      GROUP BY hotel_id, d
      ORDER BY hotel_id, d`,
    from,
    to
  );
}

export interface CapacityRow {
  hotel_id: string;
  rooms: number;
}

/**
 * Habitaciones físicas activas por hotel (capacidad disponible).
 * Verificado contra `services/property-service/prisma/schema.prisma`
 * (tabla `physical_rooms` con `is_active`).
 */
export async function capacityByHotel(db: PrismaClient): Promise<CapacityRow[]> {
  return db.$queryRawUnsafe<CapacityRow[]>(
    `SELECT hotel_id, COUNT(*)::int AS rooms
       FROM physical_rooms
      WHERE is_active = true
      GROUP BY hotel_id`
  );
}
