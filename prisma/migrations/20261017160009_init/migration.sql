-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "occupancy_daily" (
    "hotel_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "available_nights" INTEGER NOT NULL,
    "occupied_nights" INTEGER NOT NULL,
    "occupancy" DECIMAL(5,4) NOT NULL,

    CONSTRAINT "occupancy_daily_pkey" PRIMARY KEY ("hotel_id","date")
);

-- CreateTable
CREATE TABLE "kpi_by_property" (
    "hotel_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "adr" DECIMAL(12,2) NOT NULL,
    "revpar" DECIMAL(12,2) NOT NULL,
    "rooms_sold" INTEGER NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "kpi_by_property_pkey" PRIMARY KEY ("hotel_id","date")
);

-- CreateTable
CREATE TABLE "event_outbox" (
    "event_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "payload" JSON NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_outbox_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "event_outbox_status_created_at_idx" ON "event_outbox"("status", "created_at");

