import { Router, type IRouter } from "express";
import {
  accountAction, assistantIsConfigured, authIsConfigured, deletionConfigured, emailFlowsConfigured, finishEmailFlow, rateLimit, resolveAuth,
} from "../lib/auth";

const router: IRouter = Router();

router.get("/account", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  if (req.query.callback === "1") {
    try { await finishEmailFlow(req, res); }
    catch { if (!res.headersSent) res.redirect(303, "/settings?account=callback_failed#_"); }
    return;
  }
  if (!rateLimit(req, res, "account-read", 60)) return;
  const configured = authIsConfigured();
  if (!configured) {
    res.json({ configured: false, user: null, assistantConfigured: assistantIsConfigured(), emailFlowsConfigured: false, deletionConfigured: false });
    return;
  }
  const session = await resolveAuth(req, res);
  if (!session.configured) {
    res.json({ configured: false, user: null, assistantConfigured: assistantIsConfigured(), emailFlowsConfigured: false, deletionConfigured: false });
    return;
  }
  if (session.unavailable) {
    res.status(503).json({ error: "Account service is temporarily unavailable." });
    return;
  }
  res.json({
    configured: true,
    user: session.user,
    assistantConfigured: assistantIsConfigured(),
    emailFlowsConfigured: emailFlowsConfigured(),
    deletionConfigured: deletionConfigured(),
  });
});

router.post("/account", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  try {
    const result = await accountAction(req, res);
    if (res.headersSent) return;
    res.status(result.status).json(result.body);
  } catch {
    res.status(503).json({ error: "Account service is temporarily unavailable." });
  }
});

export default router;
