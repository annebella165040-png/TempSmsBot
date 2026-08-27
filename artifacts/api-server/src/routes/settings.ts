import { Router, type IRouter } from "express";
import { getPaymentSettings, updatePaymentSettings } from "../lib/paymentSettings";

const router: IRouter = Router();

router.get("/settings/payment", async (_req, res): Promise<void> => {
  res.json(await getPaymentSettings());
});

router.patch("/settings/payment", async (req, res): Promise<void> => {
  const settings = await updatePaymentSettings({
    upiId: typeof req.body?.upiId === "string" ? req.body.upiId : undefined,
    usdtBinanceId: typeof req.body?.usdtBinanceId === "string" ? req.body.usdtBinanceId : undefined,
    usdtBep20Address: typeof req.body?.usdtBep20Address === "string" ? req.body.usdtBep20Address : undefined,
    usdtTrc20Address: typeof req.body?.usdtTrc20Address === "string" ? req.body.usdtTrc20Address : undefined,
    usdtErc20Address: typeof req.body?.usdtErc20Address === "string" ? req.body.usdtErc20Address : undefined,
  });
  res.json(settings);
});

export default router;
