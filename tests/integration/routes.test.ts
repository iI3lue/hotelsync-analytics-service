jest.mock("../../src/lib/prisma", () => ({
  prisma: {
    occupancyDaily: { findMany: jest.fn(async () => []) },
    kpiByProperty: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock("../../src/lib/broker", () => ({
  broker: {
    connect: jest.fn(),
    publish: jest.fn(),
    createDispatcher: jest.fn(),
    startDispatcher: jest.fn(),
  },
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../src/index";

const HOTEL = "11111111-1111-4111-8111-111111111111";
const RANGE = { hotel_id: HOTEL, from: "2026-10-01", to: "2026-10-10" };

const auth = (role: string) => ({
  Authorization: `Bearer ${jwt.sign({ userId: "u1", role }, process.env.AUTH_JWT_SECRET as string)}`,
});

describe("API /v1 (auth, validación y contratos)", () => {
  test("sin token → 401", async () => {
    const res = await request(app).get("/v1/occupancy").query(RANGE);
    expect(res.status).toBe(401);
  });

  test("rol GUEST → 403", async () => {
    const res = await request(app).get("/v1/occupancy").set(auth("GUEST")).query(RANGE);
    expect(res.status).toBe(403);
  });

  test("hotel_id no-UUID → 400 (Zod en el borde)", async () => {
    const res = await request(app)
      .get("/v1/occupancy")
      .set(auth("MANAGER"))
      .query({ ...RANGE, hotel_id: "no-es-uuid" });
    expect(res.status).toBe(400);
  });

  test("MANAGER con rango válido → 200 con la serie (vacía sin ETL)", async () => {
    const res = await request(app).get("/v1/occupancy").set(auth("MANAGER")).query(RANGE);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test("forecast respeta el horizonte pedido", async () => {
    const res = await request(app)
      .get("/v1/forecast")
      .set(auth("SUPER_ADMIN"))
      .query({ ...RANGE, horizon: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  test("dashboard → 200 con agregados y 14 días de forecast por defecto", async () => {
    const res = await request(app)
      .get(`/v1/dashboard/${HOTEL}`)
      .set(auth("MANAGER"))
      .query({ from: RANGE.from, to: RANGE.to });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      hotel_id: HOTEL,
      occupancy_avg: 0,
      adr_avg: 0,
      revpar_avg: 0,
    });
    expect(res.body.data.forecast).toHaveLength(14);
  });

  test("dashboard con hotelId no-UUID → 400", async () => {
    const res = await request(app)
      .get("/v1/dashboard/no-uuid")
      .set(auth("MANAGER"))
      .query({ from: RANGE.from, to: RANGE.to });
    expect(res.status).toBe(400);
  });

  test("dashboard sin from/to → 400 (no llega a la DB)", async () => {
    const res = await request(app).get(`/v1/dashboard/${HOTEL}`).set(auth("MANAGER"));
    expect(res.status).toBe(400);
  });

  test("health responde ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
