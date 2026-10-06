import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getCoreDatabaseSchemaStatus } from "../lib/schemaBootstrap";

const router: IRouter = Router();

const healthResponse = (_req: unknown, res: { json: (body: unknown) => void }) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
};

// Keep both paths because Railway projects created before this route was
// standardized may still have /api/health configured as their healthcheck.
router.get("/healthz", healthResponse);
router.get("/health", healthResponse);
router.get("/db-status", async (_req, res): Promise<void> => {
  try {
    res.json(await getCoreDatabaseSchemaStatus());
  } catch (err) {
    res.status(500).json({
      configured: true,
      ready: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
