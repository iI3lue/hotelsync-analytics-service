import { Router } from "express";
import { getAdr, getForecast, getOccupancy, getRevpar } from "../controllers/metrics.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { ForecastQuerySchema, RangeQuerySchema } from "../validators/analytics";

const router = Router();
router.use(requireAuth, requireRole(["MANAGER", "SUPER_ADMIN"]));
router.get("/occupancy", validateQuery(RangeQuerySchema), getOccupancy);
router.get("/adr", validateQuery(RangeQuerySchema), getAdr);
router.get("/revpar", validateQuery(RangeQuerySchema), getRevpar);
router.get("/forecast", validateQuery(ForecastQuerySchema), getForecast);
export { router as metricsRouter };
