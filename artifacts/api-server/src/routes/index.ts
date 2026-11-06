import { Router, type IRouter } from "express";
import healthRouter from "./health";
import outreachRouter from "./outreach";

const router: IRouter = Router();

router.use(healthRouter);
router.use(outreachRouter);

export default router;
