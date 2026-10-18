# HotelSync — Analytics Service

Microservicio de revenue management de HotelSync: calcula ocupación, ADR, RevPAR y pronóstico a partir de réplicas de **solo lectura** de Booking y Property, sin joins entre bases.

- **Producción:** https://hotelsync-analytics-service.onrender.com
- **Puerto local:** 3011
- **Base de datos:** `analytics_db` (PostgreSQL 16) + réplicas read-only de `booking_db` y `property_db`

## Responsabilidad

| Hace | No hace |
| --- | --- |
| Agregar noches ocupadas e ingresos por hotel y fecha | Escribir en las bases de Booking o Property |
| Publicar métricas diarias idempotentes | Hacer joins cross-database |
| Exponer KPIs y pronóstico al panel `/admin/analytics` | Gestionar reservas, pagos o inventario |
| Ejecutar ETL programado o manual | Autenticar usuarios (valida el JWT de user-service) |

## Tecnologías

Node.js ≥20 · TypeScript · Express · Prisma · PostgreSQL 16 · Zod · RabbitMQ (outbox) · Neon (réplicas read-only).

## Arquitectura interna

`Route → Controller → Service → Prisma`. El ETL lee cada réplica con SQL crudo (`$queryRawUnsafe`, `date::text`), agrega en memoria y hace *upsert* idempotente por `(hotel_id, date)` en `OccupancyDaily` y `KpiByProperty`. Un scheduler in-process corre al arranque (delay configurable) y luego cada 6 h; un fallo se registra y no tumba el proceso. Las métricas publicadas se encolan en `EventOutbox` como `metrics.updated`.

## Endpoints

Todos exigen JWT con rol `MANAGER` o `SUPER_ADMIN`.

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | Estado del servicio |
| GET | `/v1/occupancy?hotel_id&from&to` | Ocupación diaria |
| GET | `/v1/adr?hotel_id&from&to` | Average Daily Rate |
| GET | `/v1/revpar?hotel_id&from&to` | Revenue per Available Room |
| GET | `/v1/forecast?hotel_id&from&to&horizon` | Pronóstico (`horizon` 1–90, default 14) |
| GET | `/v1/dashboard/:hotelId?from&to` | Dashboard agregado del hotel |

Fechas en formato `YYYY-MM-DD`.

## Modelo de datos

Tablas propias: `OccupancyDaily`, `KpiByProperty`, `EventOutbox`.

Migraciones en `prisma/migrations` (1). No requiere seed: los datos se derivan de las réplicas mediante el ETL.

## ETL

```bash
# Rango manual (to EXCLUSIVO)
npm run etl -- --from=2026-10-01 --to=2026-10-15
```

| Variable | Default | Descripción |
| --- | --- | --- |
| `ETL_INTERVAL_MS` | 21600000 (6 h) | Intervalo del scheduler |
| `ETL_START_DELAY_MS` | 30000 (30 s) | Delay de la primera corrida |
| `ETL_LOOKBACK_DAYS` | 7 | Ventana `[hoy - lookback, hoy)`; en producción 30 por el free tier |

Sin `DATABASE_URL_BOOKING` o `DATABASE_URL_PROPERTY` el scheduler no arranca, pero el servicio sigue respondiendo.

## Comunicación

- **REST saliente:** ninguna; solo lectura de réplicas.
- **Publica:** `metrics.updated` (vía outbox; sin `RABBITMQ_URL` queda `pending`).
- **Entrante:** el front llama `/api/analytics/*`, que Vercel reescribe a este servicio inyectando el Bearer desde la cookie.

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NODE_ENV` | No | `development` / `production` |
| `PORT` | No | Puerto HTTP (default 3011; Render inyecta `PORT`) |
| `DATABASE_URL` | Sí | Base propia `analytics_db` |
| `DATABASE_URL_BOOKING` | Sí para ETL | Réplica read-only de `booking_db` |
| `DATABASE_URL_PROPERTY` | Sí para ETL | Réplica read-only de `property_db` |
| `AUTH_JWT_SECRET` | Sí | Idéntico al de user-service |
| `RABBITMQ_URL` | No | Sin ella el outbox queda `pending` |
| `ETL_LOOKBACK_DAYS` | No | Ventana del scheduler (default 7; producción 30) |

Copiar `.env.example` a `.env` y completar los valores.

## Ejecución local

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npm run dev                 # http://localhost:3011
npm run etl -- --from=2026-10-01 --to=2026-10-15
```

## Despliegue

Render (Oregon, free): build `npm ci && npx prisma generate && npm run build`; start `npx prisma migrate deploy && npm start`; Neon `analytics_db` con el rol `hotelsync_analytics_ro` (SELECT) sobre `property_db` y `booking_db`. Migrar con host directo, no con el pooler. El plan free duerme a los 15 minutos; el lookback de 30 días cubre los huecos al despertar.

## Pruebas y verificación

```bash
npm test
npm run lint
curl https://hotelsync-analytics-service.onrender.com/health
```

## Respaldo de base de datos

```bash
pg_dump "$DATABASE_URL" -Fc -f analytics_db.dump
pg_restore --clean --if-exists -d "$DATABASE_URL" analytics_db.dump
```

## Estructura

```
src/{routes,controllers,services,validators,middleware,lib,jobs}
prisma/{schema.prisma,migrations}
tests/
```
