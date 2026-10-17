import { runEtl } from "../services/analytics.service";

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 h
const DEFAULT_START_DELAY_MS = 30_000;
const DEFAULT_LOOKBACK_DAYS = 7;

/**
 * Rango de la corrida programada: `[hoy - lookbackDays, hoy)`.
 * `to` es EXCLUSIVO a propósito: el SQL genera las noches hasta `to - 1 día`,
 * así que la ventana cubre desde hace `lookbackDays` noches hasta AYER inclusivo.
 */
export function etlRange(now: Date, lookbackDays: number): { from: string; to: string } {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - lookbackDays);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function intFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * Corrida programada del ETL (D4): arranque diferido (el servicio atiende ya)
 * + intervalo configurable. Un ETL que falla se loguea y NO tumba el proceso:
 * los agregados se reintentan en la próxima corrida y el outbox queda `pending`.
 */
export function startEtlScheduler(): { stop: () => void } {
  const intervalMs = intFromEnv("ETL_INTERVAL_MS", DEFAULT_INTERVAL_MS);
  const startDelayMs = intFromEnv("ETL_START_DELAY_MS", DEFAULT_START_DELAY_MS);
  const lookbackDays = intFromEnv("ETL_LOOKBACK_DAYS", DEFAULT_LOOKBACK_DAYS);

  const run = async () => {
    const { from, to } = etlRange(new Date(), lookbackDays);
    try {
      const result = await runEtl(from, to);
      console.log(
        `[analytics-service] etl programado hoteles=${result.hotels} dias=${result.days} rango=${from}..${to}`
      );
    } catch (err) {
      console.error("[analytics-service] etl programado fallo:", err);
    }
  };

  const startTimer = setTimeout(() => void run(), startDelayMs);
  const intervalTimer = setInterval(() => void run(), intervalMs);
  startTimer.unref?.();
  intervalTimer.unref?.();

  return {
    stop: () => {
      clearTimeout(startTimer);
      clearInterval(intervalTimer);
    },
  };
}
