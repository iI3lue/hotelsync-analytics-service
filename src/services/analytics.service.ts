import { prisma } from "../lib/prisma";
import { adr, movingAverage, occupancyRate, revpar } from "../lib/metrics";
import { bookingReplica, capacityByHotel, occupiedNights, propertyReplica } from "../lib/sources";
import { enqueueOutboxEvent } from "../lib/outbox";
import type { Dashboard, DateRange } from "../types";

/**
 * ETL periódico: réplicas de lectura → agregados propios.
 * Los endpoints leen SOLO estas tablas; jamás pegan a las réplicas en vivo.
 */
export async function runEtl(from: string, to: string): Promise<{ hotels: number; days: number }> {
  const bookingDb = bookingReplica();
  const propertyDb = propertyReplica();
  try {
    const [nights, capacity] = await Promise.all([
      occupiedNights(bookingDb, from, to),
      capacityByHotel(propertyDb),
    ]);
    const roomsByHotel = new Map(capacity.map((c) => [c.hotel_id, c.rooms]));

    const byHotelDay = new Map<string, { hotel_id: string; date: Date; occupied: number; revenue: number }>();
    for (const row of nights) {
      const key = `${row.hotel_id}|${row.night}`;
      byHotelDay.set(key, {
        hotel_id: row.hotel_id,
        date: new Date(`${row.night}T12:00:00Z`),
        occupied: row.occupied,
        revenue: Number(row.revenue),
      });
    }

    let days = 0;
    const sinHabitaciones = new Map<string, number>();
    for (const entry of byHotelDay.values()) {
      const rooms = roomsByHotel.get(entry.hotel_id) ?? 0;
      if (rooms === 0) {
        sinHabitaciones.set(entry.hotel_id, (sinHabitaciones.get(entry.hotel_id) ?? 0) + 1);
      }
      const occupancy = occupancyRate(entry.occupied, rooms);
      const adrValue = adr(entry.revenue, entry.occupied);
      const revparValue = revpar(entry.revenue, rooms);
      const date = entry.date;

      // Agregados del día + evento en UNA transacción: o quedan los tres o ninguno.
      // El dispatcher (lib/outbox) publica lo `pending`; el ETL no habla con el broker.
      await prisma.$transaction(async (tx) => {
        await tx.occupancyDaily.upsert({
          where: { hotel_id_date: { hotel_id: entry.hotel_id, date } },
          create: {
            hotel_id: entry.hotel_id,
            date,
            available_nights: rooms,
            occupied_nights: entry.occupied,
            occupancy,
          },
          update: {
            available_nights: rooms,
            occupied_nights: entry.occupied,
            occupancy,
          },
        });
        await tx.kpiByProperty.upsert({
          where: { hotel_id_date: { hotel_id: entry.hotel_id, date } },
          create: {
            hotel_id: entry.hotel_id,
            date,
            adr: adrValue,
            revpar: revparValue,
            rooms_sold: entry.occupied,
            revenue: entry.revenue,
          },
          update: {
            adr: adrValue,
            revpar: revparValue,
            rooms_sold: entry.occupied,
            revenue: entry.revenue,
          },
        });
        await enqueueOutboxEvent(tx, "metrics.updated", {
          hotel_id: entry.hotel_id,
          date: date.toISOString().slice(0, 10),
          occupancy,
          adr: adrValue,
          revpar: revparValue,
        });
      });
      days += 1;
    }
    if (sinHabitaciones.size > 0) {
      const hotelDias = [...sinHabitaciones.values()].reduce((a, b) => a + b, 0);
      const detalle = [...sinHabitaciones.entries()]
        .map(([hotelId, n]) => `${hotelId}(${n}d)`)
        .join(", ");
      console.warn(
        `[analytics-service] etl ${from}..${to}: ${hotelDias} hotel-dia(s) de ${sinHabitaciones.size} hotel(es) con reservas confirmadas y 0 habitaciones fisicas activas en property_db; su occupancy y RevPAR quedan en 0 (no son fiables, el ADR si). Hoteles: ${detalle}`,
      );
    }
    return { hotels: roomsByHotel.size, days };
  } finally {
    await Promise.all([bookingDb.$disconnect(), propertyDb.$disconnect()]);
  }
}

export async function occupancySeries(hotelId: string, range: DateRange) {
  const rows = await prisma.occupancyDaily.findMany({
    where: { hotel_id: hotelId, date: { gte: new Date(range.from), lt: new Date(range.to) } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    hotel_id: r.hotel_id,
    date: r.date.toISOString().slice(0, 10),
    available_nights: r.available_nights,
    occupied_nights: r.occupied_nights,
    occupancy: Number(r.occupancy),
  }));
}

export async function kpiSeries(hotelId: string, range: DateRange) {
  const rows = await prisma.kpiByProperty.findMany({
    where: { hotel_id: hotelId, date: { gte: new Date(range.from), lt: new Date(range.to) } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    hotel_id: r.hotel_id,
    date: r.date.toISOString().slice(0, 10),
    adr: Number(r.adr),
    revpar: Number(r.revpar),
    rooms_sold: r.rooms_sold,
    revenue: Number(r.revenue),
  }));
}

export async function forecast(hotelId: string, range: DateRange, horizon: number) {
  const history = await occupancySeries(hotelId, range);
  const occupancyHist = history.map((h) => h.occupancy);
  const kpiHist = await kpiSeries(hotelId, range);
  const adrHist = kpiHist.map((k) => k.adr);
  const occupancyExpected = movingAverage(occupancyHist);
  const adrExpected = movingAverage(adrHist);
  const out = [];
  const start = new Date(range.to);
  for (let i = 0; i < horizon; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    out.push({
      hotel_id: hotelId,
      date: date.toISOString().slice(0, 10),
      occupancy_expected: occupancyExpected,
      adr_expected: Math.round(adrExpected * 100) / 100,
      revpar_expected: Math.round(adrExpected * occupancyExpected * 100) / 100,
    });
  }
  return out;
}

export async function dashboard(hotelId: string, range: DateRange): Promise<Dashboard> {
  const [occupancy, kpi] = await Promise.all([
    occupancySeries(hotelId, range),
    kpiSeries(hotelId, range),
  ]);
  const occupancyAvg = movingAverage(occupancy.map((o) => o.occupancy), occupancy.length || 1);
  const adrAvg = movingAverage(kpi.map((k) => k.adr), kpi.length || 1);
  const revparAvg = movingAverage(kpi.map((k) => k.revpar), kpi.length || 1);
  return {
    hotel_id: hotelId,
    range,
    occupancy_avg: occupancyAvg,
    adr_avg: Math.round(adrAvg * 100) / 100,
    revpar_avg: Math.round(revparAvg * 100) / 100,
    forecast: await forecast(hotelId, range, 14),
  };
}
