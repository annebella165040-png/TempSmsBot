import { Router, type IRouter } from "express";
import healthRouter from "./health";
import panelsRouter from "./panels";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import giftCardsRouter from "./giftcards";
import botRouter from "./bot";
import adminRouter from "./admin";
import broadcastRouter from "./broadcast";
import channelsRouter from "./channels";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(panelsRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(giftCardsRouter);
router.use(broadcastRouter);
router.use(channelsRouter);
router.use(botRouter);

export default router;
