jest.mock("../../src/lib/prisma", () => {
  const tx = {
    occupancyDaily: { upsert: jest.fn(async () => ({})) },
    kpiByProperty: { upsert: jest.fn(async () => ({})) },
    eventOutbox: { create: jest.fn(async () => ({})) },
  };
  return {
    prisma: {
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
      ...tx,
    },
  };
});

jest.mock("../../src/lib/sources", () => ({
  bookingReplica: () => ({ $disconnect: jest.fn(async () => undefined) }),
  propertyReplica: () => ({ $disconnect: jest.fn(async () => undefined) }),
  occupiedNights: jest.fn(),
  capacityByHotel: jest.fn(),
}));

jest.mock("../../src/lib/broker", () => ({
  broker: {
    connect: jest.fn(),
    publish: jest.fn(),
    createDispatcher: jest.fn(),
    startDispatcher: jest.fn(),
  },
}));

import { prisma } from "../../src/lib/prisma";
import { broker } from "../../src/lib/broker";
import { capacityByHotel, occupiedNights } from "../../src/lib/sources";
import { runEtl } from "../../src/services/analytics.service";

const HOTEL = "11111111-1111-4111-8111-111111111111";
const DAY = new Date("2026-10-10T12:00:00Z");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("runEtl (réplicas → agregados + outbox)", () => {
  test("calcula ocupación/ADR/RevPAR y encola metrics.updated sin publicar directo", async () => {
    (occupiedNights as jest.Mock).mockResolvedValue([
      { hotel_id: HOTEL, night: "2026-10-10", occupied: 2, revenue: "300000" },
    ]);
    (capacityByHotel as jest.Mock).mockResolvedValue([{ hotel_id: HOTEL, rooms: 4 }]);

    const result = await runEtl("2026-10-10", "2026-10-11");

    expect(result).toEqual({ hotels: 1, days: 1 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    const occArgs = (prisma.occupancyDaily.upsert as jest.Mock).mock.calls[0][0];
    expect(occArgs.where).toEqual({ hotel_id_date: { hotel_id: HOTEL, date: DAY } });
    expect(occArgs.create.available_nights).toBe(4);
    expect(occArgs.create.occupancy).toBeCloseTo(0.5);

    const kpiArgs = (prisma.kpiByProperty.upsert as jest.Mock).mock.calls[0][0];
    expect(kpiArgs.create.revenue).toBe(300000);
    expect(kpiArgs.create.adr).toBeCloseTo(150000);
    expect(kpiArgs.create.revpar).toBeCloseTo(75000);

    const outboxArgs = (prisma.eventOutbox.create as jest.Mock).mock.calls[0][0];
    expect(outboxArgs.data.event_type).toBe("metrics.updated");
    expect(outboxArgs.data).not.toHaveProperty("status"); // default `pending` en la DB
    expect(outboxArgs.data.payload).toEqual({
      hotel_id: HOTEL,
      date: "2026-10-10",
      occupancy: 0.5,
      adr: 150000,
      revpar: 75000,
    });

    expect(broker.publish).not.toHaveBeenCalled();
  });

  test("es idempotente: upsert por (hotel_id, date) en corridas repetidas", async () => {
    (occupiedNights as jest.Mock).mockResolvedValue([
      { hotel_id: HOTEL, night: "2026-10-10", occupied: 1, revenue: "120000" },
    ]);
    (capacityByHotel as jest.Mock).mockResolvedValue([{ hotel_id: HOTEL, rooms: 2 }]);

    await runEtl("2026-10-10", "2026-10-11");
    await runEtl("2026-10-10", "2026-10-11");

    const calls = (prisma.occupancyDaily.upsert as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call[0].where).toEqual({ hotel_id_date: { hotel_id: HOTEL, date: DAY } });
    }
    expect(prisma.eventOutbox.create).toHaveBeenCalledTimes(2);
  });

  test("sin noches ocupadas no escribe nada", async () => {
    (occupiedNights as jest.Mock).mockResolvedValue([]);
    (capacityByHotel as jest.Mock).mockResolvedValue([]);

    const result = await runEtl("2026-10-10", "2026-10-11");

    expect(result).toEqual({ hotels: 0, days: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.eventOutbox.create).not.toHaveBeenCalled();
  });

  test("hotel con reservas y 0 habitaciones fisicas: escribe el dia y avisa", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    (occupiedNights as jest.Mock).mockResolvedValue([
      { hotel_id: HOTEL, night: "2026-10-10", occupied: 3, revenue: "90000" },
    ]);
    (capacityByHotel as jest.Mock).mockResolvedValue([]);

    const result = await runEtl("2026-10-10", "2026-10-11");

    expect(result).toEqual({ hotels: 0, days: 1 });

    const occArgs = (prisma.occupancyDaily.upsert as jest.Mock).mock.calls[0][0];
    expect(occArgs.create.available_nights).toBe(0);
    expect(occArgs.create.occupancy).toBe(0);

    const kpiArgs = (prisma.kpiByProperty.upsert as jest.Mock).mock.calls[0][0];
    expect(kpiArgs.create.adr).toBe(30000);
    expect(kpiArgs.create.revpar).toBe(0);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(HOTEL);
    warn.mockRestore();
  });
});
