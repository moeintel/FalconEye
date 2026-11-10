import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import accountRouter from "./routes/account";
import { createFinanceRouter } from "./routes/finance";

export { accountRouter, createFinanceRouter };

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const safeError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "This request is too large." });
    return;
  }
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON request." });
    return;
  }
  res.status(500).json({ error: "Unable to complete this request." });
};
app.use(safeError);

export default app;
