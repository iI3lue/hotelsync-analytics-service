import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { broker } from "./broker";

export type AnalyticsEventType = "metrics.updated";

export interface MetricsUpdatedPayload {
  hotel_id: string;
  date: string; // YYYY-MM-DD
  occupancy: number;
  adr: number;
  revpar: number;
  [key: string]: unknown;
}

/**
 * Encola un evento en el outbox DENTRO de la transacción del llamador:
 * los agregados del día y su evento se confirman juntos (rollback conjunto).
 * `event_id` y `status: "pending"` los pone la DB por default.
 */
export async function enqueueOutboxEvent(
  tx: Prisma.TransactionClient,
  eventType: AnalyticsEventType,
  payload: MetricsUpdatedPayload
): Promise<void> {
  await tx.eventOutbox.create({
    data: { event_type: eventType, payload: payload as Prisma.InputJsonValue },
  });
}

/**
 * Dispatcher del outbox: publica con confirm y marca `sent` solo tras
 * el confirm. Si el broker cae, las filas quedan `pending` y se reintentan.
 */
export function createOutboxDispatcher() {
  return broker.createDispatcher(
    async () => {
      const rows = await prisma.eventOutbox.findMany({
        where: { status: "pending" },
        orderBy: { created_at: "asc" },
        take: 100,
      });
      return rows.map((r) => ({
        event_id: r.event_id,
        event_type: r.event_type,
        payload: r.payload as unknown,
      }));
    },
    async (eventId: string) => {
      await prisma.eventOutbox.update({
        where: { event_id: eventId },
        data: { status: "sent", sent_at: new Date() },
      });
    }
  );
}

/**
 * Arranca el drenaje periódico del outbox. Llamar una sola vez en index.ts
 * (fuera de tests y solo cuando hay RABBITMQ_URL configurado).
 */
export function startOutboxDispatcher(intervalMs = 10000): NodeJS.Timeout {
  const dispatcher = createOutboxDispatcher();
  return broker.startDispatcher(() => dispatcher.flush(), intervalMs);
}

/**
 * Drena el outbox una vez (corridas manuales del ETL). Sin broker no hace
 * nada: las filas quedan `pending` y las levanta el dispatcher del servicio.
 */
export async function flushOutbox(): Promise<number> {
  if (!process.env.RABBITMQ_URL) return 0;
  return createOutboxDispatcher().flush();
}
