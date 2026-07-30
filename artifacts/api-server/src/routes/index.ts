import { Router, type IRouter } from "express";
import healthRouter from "./health";
import panelsRouter from "./panels";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import giftCardsRouter from "./giftcards";
import botRouter from "./bot";

const router: IRouter = Router();

router.use(healthRouter);
router.use(panelsRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(giftCardsRouter);
router.use(botRouter);

export default router;
