/**
 * Matemática pura de revenue management (única fuente de verdad, ver PRD §2).
 * Sin I/O: 100% testeable con Jest.
 */

export function occupancyRate(occupiedNights: number, availableNights: number): number {
  if (!Number.isFinite(occupiedNights) || !Number.isFinite(availableNights)) return 0;
  if (availableNights <= 0) return 0;
  const rate = occupiedNights / availableNights;
  return Math.min(1, Math.max(0, rate));
}

/** Tarifa diaria promedio. 0 si no hubo ventas (evita dividir por cero). */
export function adr(roomRevenue: number, roomsSold: number): number {
  if (!Number.isFinite(roomRevenue) || !Number.isFinite(roomsSold)) return 0;
  if (roomsSold <= 0) return 0;
  return roomRevenue / roomsSold;
}

/** Ingreso por habitación disponible. Igual a ADR × ocupación. */
export function revpar(roomRevenue: number, availableRooms: number): number {
  if (!Number.isFinite(roomRevenue) || !Number.isFinite(availableRooms)) return 0;
  if (availableRooms <= 0) return 0;
  return roomRevenue / availableRooms;
}

/**
 * Previsión v1: media móvil de las últimas `window` observaciones.
 * Devuelve el promedio redondeado a 4 decimales (suficiente para ratios).
 */
export function movingAverage(values: number[], window = 7): number {
  const sample = values.filter((v) => Number.isFinite(v)).slice(-Math.max(1, window));
  if (sample.length === 0) return 0;
  const avg = sample.reduce((a, b) => a + b, 0) / sample.length;
  return Math.round(avg * 10000) / 10000;
}
