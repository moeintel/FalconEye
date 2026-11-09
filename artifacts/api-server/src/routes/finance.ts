import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { hasValidOrigin, rateLimit, resolveAuth } from "../lib/auth";
import { validateFinanceDocument } from "../lib/finance-validation";
import { saveFinanceDocument, deleteFinanceDocument } from "../lib/finance-persistence";

const router: IRouter = Router();
export const MAX_FINANCE_DOCUMENT_BYTES = 512 * 1024;

function sendDatabaseError(req: { log?: { error: (message: string) => void } }, res: {
  status: (status: number) => { json: (body: unknown) => void };
}): void {
  req.log?.error("Finance storage is unavailable");
  res.status(503).json({ error: "Finance storage is unavailable. Please verify database setup." });
}

async function requireOwner(req: Parameters<typeof resolveAuth>[0], res: Parameters<typeof resolveAuth>[1]) {
  if (!rateLimit(req, res, "auth-check", 120)) return null;
  const auth = await resolveAuth(req, res);
  if (!auth.configured) {
    res.status(503).json({ error: "Account service is not configured." });
    return null;
  }
  if (auth.unavailable) {
    res.status(503).json({ error: "Account service is temporarily unavailable." });
    return null;
  }
  if (!auth.user) {
    res.status(401).json({ error: "Authentication is required." });
    return null;
  }
  return auth.user;
}

function validRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value >= 0;
}

router.get("/finance", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  try {
    const user = await requireOwner(req, res);
    if (!user) return;
    const result = await pool.query(
      "SELECT document, revision FROM falcon_finance_documents WHERE user_id = $1",
      [user.id],
    );
    if (!result.rows.length) {
      res.json({ document: null, revision: 0 });
      return;
    }
    const revision = Number(result.rows[0].revision);
    if (!Number.isSafeInteger(revision) || revision < 1) {
      sendDatabaseError(req, res);
      return;
    }
    res.json({ document: result.rows[0].document, revision });
  } catch {
    sendDatabaseError(req, res);
  }
});

router.put("/finance", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  if (!hasValidOrigin(req)) {
    res.status(403).json({ error: "Request origin is not allowed." });
    return;
  }
  if (!rateLimit(req, res, "finance-write", 60)) return;
  if (req.body === null || typeof req.body !== "object" || Array.isArray(req.body) ||
      Object.keys(req.body).some((key) => !["document", "revision"].includes(key)) ||
      !Object.prototype.hasOwnProperty.call(req.body, "document") ||
      !validRevision(req.body.revision) ||
      Buffer.byteLength(JSON.stringify(req.body.document), "utf8") > MAX_FINANCE_DOCUMENT_BYTES ||
      !validateFinanceDocument(req.body.document)) {
    res.status(400).json({ error: "Invalid finance document or revision." });
    return;
  }
  try {
    const user = await requireOwner(req, res);
    if (!user) return;
    const saved = await saveFinanceDocument(pool, user.id, req.body.document, req.body.revision);
    if (saved.kind === "conflict") {
      res.status(409).json({
        error: "Finance data changed in another session.",
        revision: saved.revision,
      });
      return;
    }
    res.json({ document: saved.document, revision: saved.revision });
  } catch {
    sendDatabaseError(req, res);
  }
});

router.delete("/finance", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  if (!hasValidOrigin(req)) {
    res.status(403).json({ error: "Request origin is not allowed." });
    return;
  }
  if (!rateLimit(req, res, "finance-delete", 20)) return;
  const body = req.body;
  if (body === null || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !["confirmation", "revision"].includes(key)) ||
      body.confirmation !== "DELETE MY FINANCIAL DATA" || !validRevision(body.revision)) {
    res.status(400).json({ error: "Explicit deletion confirmation and revision are required." });
    return;
  }
  try {
    const user = await requireOwner(req, res);
    if (!user) return;
    const deleted = await deleteFinanceDocument(pool, user.id, body.revision);
    if (deleted.kind === "deleted") {
      res.json({ success: true });
      return;
    }
    res.status(409).json({
      error: "Finance data changed in another session.",
      revision: deleted.revision,
    });
  } catch {
    sendDatabaseError(req, res);
  }
});

export default router;
