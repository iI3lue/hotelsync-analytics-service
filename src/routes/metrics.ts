import { Router } from "express";
import { getAdr, getForecast, getOccupancy, getRevpar } from "../controllers/metrics.controller";
import { requireAuth, requireHotelScope, requireRole } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { ForecastQuerySchema, RangeQuerySchema } from "../validators/analytics";

const router = Router();
router.use(requireAuth, requireRole(["MANAGER", "SUPER_ADMIN"]));
router.get("/occupancy", validateQuery(RangeQuerySchema), requireHotelScope, getOccupancy);
router.get("/adr", validateQuery(RangeQuerySchema), requireHotelScope, getAdr);
router.get("/revpar", validateQuery(RangeQuerySchema), requireHotelScope, getRevpar);
router.get("/forecast", validateQuery(ForecastQuerySchema), requireHotelScope, getForecast);
export { router as metricsRouter };
