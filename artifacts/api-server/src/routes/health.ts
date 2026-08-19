import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const healthResponse = (_req: unknown, res: { json: (body: unknown) => void }) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
};

// Keep both paths because Railway projects created before this route was
// standardized may still have /api/health configured as their healthcheck.
router.get("/healthz", healthResponse);
router.get("/health", healthResponse);

export default router;
