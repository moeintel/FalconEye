import { Router, type IRouter } from "express";
import healthRouter from "./health";
import outreachRouter from "./outreach";
import financeRouter from "./finance";
import accountRouter from "./account";
import assistantRouter from "./assistant";

const router: IRouter = Router();

router.use(healthRouter);
router.use(outreachRouter);
router.use(accountRouter);
router.use(financeRouter);
router.use(assistantRouter);

export default router;
