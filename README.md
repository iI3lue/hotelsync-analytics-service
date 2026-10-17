# HotelSync Analytics Service

Microservicio de revenue management de HotelSync (punto de venta 3011).

- Agrega noches ocupadas e ingresos desde replicas de **solo lectura** de
  `booking_db` y `property_db`.
- Expone `/v1/occupancy`, `/v1/adr`, `/v1/revpar`, `/v1/forecast` y
  `/v1/dashboard/:hotelId` (roles MANAGER y SUPER_ADMIN).
- ETL idempotente por `(hotel_id, date)` con outbox `pending -> sent` hacia
  RabbitMQ (`hotelsync.events`, evento `metrics.updated`).
- Scheduler in-process cada 6 h; corrida manual:
  `npm run etl -- --from=YYYY-MM-DD --to=YYYY-MM-DD` (`to` es exclusivo).

## Scripts

```bash
npm ci
npx prisma generate
npm run build
npm start          # npx prisma migrate deploy && npm start en produccion
npm test
npm run lint       # tsc --noEmit
```

## Variables de entorno

Ver `.env.example`. `DATABASE_URL` apunta a la base propia del servicio;
`DATABASE_URL_BOOKING` y `DATABASE_URL_PROPERTY` usan roles read-only.
`AUTH_JWT_SECRET` debe ser identico al de `user-service`.

## Deploy

Render (Node runtime): build `npm ci && npx prisma generate && npm run build`,
start `npx prisma migrate deploy && npm start`. `.npmrc` fuerza la instalacion
de devDependencies (tsc/prisma) en builds con `NODE_ENV=production`.
