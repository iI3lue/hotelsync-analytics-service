import { runEtl } from "../services/analytics.service";

/**
 * Corrida manual del ETL: `npm run etl -- --from=2026-10-01 --to=2026-10-14`.
 * En producción lo dispara el cron con el rango del día anterior.
 */
async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v];
    })
  );
  const to = args.to ?? new Date().toISOString().slice(0, 10);
  const from =
    args.from ??
    new Date(new Date(to).getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const result = await runEtl(from, to);
  console.log(`[etl] hoteles=${result.hotels} días=${result.days} rango=${from}..${to}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[etl] falló:", err);
  process.exit(1);
});
