import { Router, type IRouter, type RequestHandler } from "express";
import { db, interestTable, visitsTable } from "@workspace/db";
import { count } from "drizzle-orm";
import {
  RegisterInterestBody,
  RegisterInterestResponse,
  RecordVisitBody,
  RecordVisitResponse,
  GetOutreachResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const buckets = new Map<string, { count: number; until: number }>();
const limit: RequestHandler = (req, res, next) => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.until < now) buckets.delete(key);
  const key = `${req.ip}:${req.path}`;
  const bucket = buckets.get(key) ?? { count: 0, until: now + 15 * 60_000 };
  bucket.count++;
  buckets.set(key, bucket);
  if (bucket.count > 100) {
    res.status(429).json({ error: "Please try again later." });
    return;
  }
  next();
};

router.post("/interest", limit, async (req, res): Promise<void> => {
  const parsed = RegisterInterestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid email and channel are required." });
    return;
  }
  try {
    await db.insert(interestTable).values({
      email: parsed.data.email.trim().toLowerCase(),
      channel: parsed.data.channel,
    }).onConflictDoNothing({ target: interestTable.email });
    // Identical reply for duplicates: no email enumeration, no double counting.
    res.json(RegisterInterestResponse.parse({ success: true }));
  } catch {
    req.log.error("Unable to save interest");
    res.status(503).json({ error: "Unable to save interest. Please try again." });
  }
});

router.post("/visit", limit, async (req, res): Promise<void> => {
  const parsed = RecordVisitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid channel is required." });
    return;
  }
  try {
    await db.insert(visitsTable).values({ channel: parsed.data.channel });
    res.json(RecordVisitResponse.parse({ success: true }));
  } catch {
    req.log.error("Unable to record visit");
    res.status(503).json({ error: "Unable to record visit." });
  }
});

router.get("/outreach", async (req, res): Promise<void> => {
  try {
    const [opens, signups] = await Promise.all([
      db.select({ channel: visitsTable.channel, opened: count() }).from(visitsTable).groupBy(visitsTable.channel),
      db.select({ channel: interestTable.channel, signedUp: count() }).from(interestTable).groupBy(interestTable.channel),
    ]);
    const channels = [...new Set(["whatsapp", "linkedin", "email", "direct", ...opens.map((x) => x.channel), ...signups.map((x) => x.channel)])]
      .map((channel) => ({
        channel,
        opened: opens.find((x) => x.channel === channel)?.opened ?? 0,
        signedUp: signups.find((x) => x.channel === channel)?.signedUp ?? 0,
      }));
    res.set("Cache-Control", "no-store");
    res.json(GetOutreachResponse.parse({ channels }));
  } catch {
    req.log.error("Unable to load outreach totals");
    res.status(503).json({ error: "Unable to load outreach totals." });
  }
});

export default router;
