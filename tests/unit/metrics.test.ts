import { adr, movingAverage, occupancyRate, revpar } from "../../src/lib/metrics";

describe("métricas de revenue management (PRD §2)", () => {
  test("ocupación = ocupadas / disponibles, acotada a 0–1", () => {
    expect(occupancyRate(7, 10)).toBeCloseTo(0.7);
    expect(occupancyRate(0, 10)).toBe(0);
    expect(occupancyRate(5, 0)).toBe(0);
    expect(occupancyRate(12, 10)).toBe(1);
  });

  test("ADR = ingreso / vendidas, 0 sin ventas", () => {
    expect(adr(850000, 10)).toBe(85000);
    expect(adr(0, 0)).toBe(0);
  });

  test("RevPAR = ingreso / disponibles = ADR × ocupación", () => {
    const revenue = 850000;
    const sold = 10;
    const available = 20;
    expect(revpar(revenue, available)).toBeCloseTo(
      adr(revenue, sold) * occupancyRate(sold, available)
    );
  });

  test("media móvil con ventana y sin datos", () => {
    expect(movingAverage([0.5, 0.6, 0.7], 2)).toBeCloseTo(0.65);
    expect(movingAverage([], 7)).toBe(0);
    expect(movingAverage([0.8], 7)).toBeCloseTo(0.8);
  });
});
