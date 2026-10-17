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

import { capacityByHotel, occupiedNights } from "../../src/lib/sources";
import { etlRange, startEtlScheduler } from "../../src/jobs/scheduler";

const DAY = 86400000;

describe("etlRange", () => {
  test("ventana [hoy-N, hoy): cubre desde hace N noches hasta ayer inclusive", () => {
    expect(etlRange(new Date("2026-10-17T10:00:00Z"), 7)).toEqual({
      from: "2026-10-10",
      to: "2026-10-17",
    });
  });

  test("lookback de 1 día = solo la noche de ayer", () => {
    expect(etlRange(new Date("2026-10-17T10:00:00Z"), 1)).toEqual({
      from: "2026-10-16",
      to: "2026-10-17",
    });
  });

  test("cruza fin de mes sin desfase", () => {
    expect(etlRange(new Date("2026-11-03T00:30:00Z"), 7)).toEqual({
      from: "2026-10-27",
      to: "2026-11-03",
    });
  });
});

describe("startEtlScheduler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    process.env.ETL_START_DELAY_MS = "1000";
    process.env.ETL_LOOKBACK_DAYS = "7";
    delete process.env.ETL_INTERVAL_MS;
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.ETL_START_DELAY_MS;
    delete process.env.ETL_LOOKBACK_DAYS;
  });

  test("arranque diferido: no corre antes del delay y luego usa [hoy-7, hoy)", async () => {
    (occupiedNights as jest.Mock).mockResolvedValue([]);
    (capacityByHotel as jest.Mock).mockResolvedValue([]);

    const scheduler = startEtlScheduler();
    expect(occupiedNights).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1000);

    expect(occupiedNights).toHaveBeenCalledTimes(1);
    const [, from, to] = (occupiedNights as jest.Mock).mock.calls[0];
    const today = new Date().toISOString().slice(0, 10);
    expect(to).toBe(today);
    expect(new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()).toBe(
      7 * DAY
    );

    scheduler.stop();
  });

  test("un ETL que falla se loguea y no tumba el proceso (outbox reintenta)", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    (occupiedNights as jest.Mock).mockRejectedValue(new Error("replica caída"));

    const scheduler = startEtlScheduler();
    await expect(jest.advanceTimersByTimeAsync(1000)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
    scheduler.stop();
  });
});
