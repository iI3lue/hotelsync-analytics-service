import express from "express";
import { errorHandler } from "./middleware/error-handler";
import { metricsRouter } from "./routes/metrics";
import { dashboardRouter } from "./routes/dashboard";
import { startOutboxDispatcher } from "./lib/outbox";
import { startEtlScheduler } from "./jobs/scheduler";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET /v1/occupancy | /v1/adr | /v1/revpar | /v1/forecast
app.use("/v1", metricsRouter);
// GET /v1/dashboard/:hotelId
app.use("/v1/dashboard", dashboardRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 3011;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`[analytics-service] Servidor corriendo en puerto ${PORT}`);
  });

  // Dispatcher de `metrics.updated` (solo con broker; sin RABBITMQ_URL las
  // filas del outbox quedan `pending` y el servicio opera igual).
  if (process.env.RABBITMQ_URL) {
    startOutboxDispatcher();
    console.log("[analytics-service] outbox dispatcher iniciado");
  }

  // Corrida programada del ETL (D4): arranque diferido + ETL_INTERVAL_MS.
  // Sin las réplicas configuradas no arranca (el ETL no tendría de dónde leer).
  if (process.env.DATABASE_URL_BOOKING && process.env.DATABASE_URL_PROPERTY) {
    startEtlScheduler();
    console.log("[analytics-service] etl scheduler iniciado");
  } else {
    console.warn(
      "[analytics-service] etl scheduler deshabilitado (faltan DATABASE_URL_BOOKING/DATABASE_URL_PROPERTY)"
    );
  }
}

export default app;
