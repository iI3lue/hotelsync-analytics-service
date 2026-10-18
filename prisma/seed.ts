import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Seed opcional de demostración. Genera métricas sintéticas idempotentes por
// `(hotel_id, date)` para que el dashboard `/admin/analytics` muestre datos sin
// depender del ETL. En operación las métricas reales las escribe el ETL.
const DEMO_HOTEL_ID = "22222222-2222-4222-8222-222222222222";
const ROOMS_AVAILABLE = 30;

function utcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

// Valor estable por (hotel, fecha) para que re-ejecutar el seed no cambie cifras.
function demoSeed(hotelId: string, date: Date): number {
  let hash = Math.floor(date.getTime() / 86_400_000);
  for (const char of hotelId) {
    hash = (hash * 31 + char.charCodeAt(0)) % 2147483647;
  }
  return Math.abs(hash);
}

async function main() {
  const hotelId = process.env.SEED_HOTEL_ID ?? DEMO_HOTEL_ID;
  const days = Math.max(1, Number(process.env.SEED_DAYS ?? "14"));
  const today = utcDay(new Date());

  console.log(
    `Seeding analytics demo metrics for hotel ${hotelId} (${days} days)...`
  );

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(today.getTime() - offset * 86_400_000);
    const seed = demoSeed(hotelId, date);

    const occupiedNights = 10 + (seed % 18); // 10..27 noches ocupadas
    const occupancy = Number((occupiedNights / ROOMS_AVAILABLE).toFixed(4));
    const adr = 180000 + (seed % 7) * 15000;
    const revenue = occupiedNights * adr;
    const revpar = Number((revenue / ROOMS_AVAILABLE).toFixed(2));

    await prisma.occupancyDaily.upsert({
      where: { hotel_id_date: { hotel_id: hotelId, date } },
      update: {
        available_nights: ROOMS_AVAILABLE,
        occupied_nights: occupiedNights,
        occupancy,
      },
      create: {
        hotel_id: hotelId,
        date,
        available_nights: ROOMS_AVAILABLE,
        occupied_nights: occupiedNights,
        occupancy,
      },
    });

    await prisma.kpiByProperty.upsert({
      where: { hotel_id_date: { hotel_id: hotelId, date } },
      update: { adr, revpar, rooms_sold: occupiedNights, revenue },
      create: {
        hotel_id: hotelId,
        date,
        adr,
        revpar,
        rooms_sold: occupiedNights,
        revenue,
      },
    });
  }

  console.log(`Seeded ${days} days of demo metrics for hotel ${hotelId}.`);
  console.log("Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Analytics seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
