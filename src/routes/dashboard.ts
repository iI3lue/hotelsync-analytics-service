import { Router } from "express";
import { getDashboard } from "../controllers/dashboard.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateParams, validateQuery } from "../middleware/validate";
import { DashboardParamsSchema, DashboardQuerySchema } from "../validators/analytics";

const router = Router();
router.use(requireAuth, requireRole(["MANAGER", "SUPER_ADMIN"]));
router.get(
  "/:hotelId",
  validateParams(DashboardParamsSchema),
  validateQuery(DashboardQuerySchema),
  getDashboard
);
export { router as dashboardRouter };
