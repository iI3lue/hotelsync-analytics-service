import { Router } from "express";
import { getDashboard } from "../controllers/dashboard.controller";
import { requireAuth, requireHotelScope, requireRole } from "../middleware/auth";
import { validateParams, validateQuery } from "../middleware/validate";
import { DashboardParamsSchema, DashboardQuerySchema } from "../validators/analytics";

const router = Router();
router.use(requireAuth, requireRole(["MANAGER", "SUPER_ADMIN"]));
router.get(
  "/:hotelId",
  validateParams(DashboardParamsSchema),
  requireHotelScope,
  validateQuery(DashboardQuerySchema),
  getDashboard
);
export { router as dashboardRouter };
