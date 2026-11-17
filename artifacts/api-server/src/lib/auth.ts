import type { Request, Response } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type AuthUser = { id: string; email: string | null };
type SupabaseConfig = { url: string; key: string };
type AuthResolution =
  | { configured: false; user: null; accessToken: null }
  | { configured: true; user: AuthUser | null; accessToken: string | null; unavailable?: boolean };

const ACCESS_COOKIE = "fe_access";
const REFRESH_COOKIE = "fe_refresh";
const PKCE_COOKIE = "fe_pkce";
const buckets = new Map<string, { count: number; until: number }>();
const actions = new Set(["signin", "signup", "signout", "recover", "password", "delete"]);

export function supabaseConfig(): SupabaseConfig | null {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl || !key) return null;
  try {
    const parsed = new URL(rawUrl);
    const localHttp = parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) &&
      process.env.NODE_ENV !== "production";
    if ((parsed.protocol !== "https:" && !localHttp) || parsed.username || parsed.password ||
        parsed.pathname !== "/" || parsed.search || parsed.hash || key.length > 4096) return null;
    return { url: parsed.origin, key };
  } catch {
    return null;
  }
}

export const authIsConfigured = () => supabaseConfig() !== null;

function appOrigin(): string | null {
  try {
    const origin = process.env.APP_ORIGIN;
    if (!origin) return null;
    const url = new URL(origin);
    const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return url.origin === origin && (url.protocol === "https:" || (local && url.protocol === "http:")) ? origin : null;
  } catch { return null; }
}

export function emailFlowsConfigured(): boolean {
  // Enable only after the exact callback URL is allowed in Supabase Auth.
  return authIsConfigured() && appOrigin() !== null && process.env.AUTH_EMAIL_REDIRECTS_READY === "true";
}

function adminKey(): string | null {
  return process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

export const deletionConfigured = () => authIsConfigured() && Boolean(adminKey());
const secureCookie = () => process.env.NODE_ENV === "production" || appOrigin()?.startsWith("https:") ? "; Secure" : "";

export function assistantIsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function rateLimit(req: Request, res: Response, namespace: string, maximum = 40): boolean {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
  if (buckets.size > 10_000) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }
  // Express's default req.ip does not trust forwarded headers.
  const key = `${namespace}:${req.ip || "unknown"}`;
  const bucket = buckets.get(key) ?? { count: 0, until: now + 15 * 60_000 };
  bucket.count++;
  buckets.set(key, bucket);
  if (bucket.count <= maximum) return true;
  res.status(429).json({ error: "Please try again later." });
  return false;
}

export function hasValidOrigin(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) return false;
    const allowed = new Set<string>();
    const host = req.get("host");
    if (host) {
      const protocol = req.protocol;
      allowed.add(`${protocol}://${host}`);
      if (protocol === "http") allowed.add(`https://${host}`);
    }
    if (process.env.APP_ORIGIN) {
      try {
        const configured = new URL(process.env.APP_ORIGIN);
        if (configured.origin === process.env.APP_ORIGIN) allowed.add(configured.origin);
      } catch {
        // Invalid deployment configuration does not grant a cross-origin exception.
      }
    }
    return allowed.has(parsed.origin);
  } catch {
    return false;
  }
}

function readCookie(req: Request, name: string): string | null {
  const header = req.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      return value.length <= 7000 ? value : null;
    } catch {
      return null;
    }
  }
  return null;
}

function setSessionCookies(res: Response, access: string, refresh: string): boolean {
  if (!access || !refresh || access.length > 3500 || refresh.length > 3500) return false;
  const secure = secureCookie();
  // Keep the access cookie present past JWT expiry so the server can validate
  // it, rotate with the refresh token, and never expose tokens to browser JS.
  res.append("Set-Cookie", `${ACCESS_COOKIE}=${encodeURIComponent(access)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);
  res.append("Set-Cookie", `${REFRESH_COOKIE}=${encodeURIComponent(refresh)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);
  return true;
}

export function clearSessionCookies(res: Response): void {
  const secure = secureCookie();
  res.append("Set-Cookie", `${ACCESS_COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
  res.append("Set-Cookie", `${REFRESH_COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function clearPkceCookie(res: Response): void {
  res.append("Set-Cookie", `${PKCE_COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie()}`);
}

type EmailFlow = { verifier: string; state: string; kind: "signup" | "recover"; expires: number };
function beginEmailFlow(res: Response, kind: EmailFlow["kind"]) {
  const flow: EmailFlow = {
    verifier: randomBytes(32).toString("base64url"),
    state: randomBytes(32).toString("base64url"),
    kind, expires: Date.now() + 60 * 60_000,
  };
  const redirect = new URL("/api/account", appOrigin()!);
  redirect.searchParams.set("callback", "1");
  redirect.searchParams.set("state", flow.state);
  res.append("Set-Cookie", `${PKCE_COOKIE}=${encodeURIComponent(JSON.stringify(flow))}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=3600${secureCookie()}`);
  return {
    redirect: redirect.toString(),
    challenge: createHash("sha256").update(flow.verifier).digest("base64url"),
  };
}

function pendingEmailFlow(req: Request): EmailFlow | null {
  try {
    const flow = JSON.parse(readCookie(req, PKCE_COOKIE) ?? "null");
    if (!flow || typeof flow !== "object" || Array.isArray(flow) ||
        !/^[A-Za-z0-9_-]{43}$/.test(flow.verifier) || !/^[A-Za-z0-9_-]{43}$/.test(flow.state) ||
        !["signup", "recover"].includes(flow.kind) || !Number.isFinite(flow.expires) ||
        flow.expires <= Date.now() || flow.expires > Date.now() + 60 * 60_000) return null;
    return flow;
  } catch { return null; }
}

export async function finishEmailFlow(req: Request, res: Response): Promise<void> {
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
  const failed = () => { res.redirect(303, "/settings?account=callback_failed#_"); };
  if (!rateLimit(req, res, "account-callback", 30)) return;
  const config = supabaseConfig();
  const flow = pendingEmailFlow(req);
  const { state, code } = req.query;
  if (!config || !emailFlowsConfigured() || !flow || typeof state !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(state) || !timingSafeEqual(Buffer.from(state), Buffer.from(flow.state)) ||
      typeof code !== "string" || code.length < 1 || code.length > 2048) {
    failed(); return;
  }
  clearPkceCookie(res);
  const exchanged = await authFetch(config, "token?grant_type=pkce", {
    method: "POST", body: { auth_code: code, code_verifier: flow.verifier },
  });
  if (!exchanged.response?.ok || !exchanged.body || typeof exchanged.body !== "object") { failed(); return; }
  const tokens = exchanged.body as Record<string, unknown>;
  if (typeof tokens.access_token !== "string" || typeof tokens.refresh_token !== "string") { failed(); return; }
  const verified = await verifyAccess(config, tokens.access_token);
  if (!verified.user || !setSessionCookies(res, tokens.access_token, tokens.refresh_token)) { failed(); return; }
  res.redirect(303, `/settings?account=${flow.kind === "recover" ? "recovered" : "confirmed"}#_`);
}

type AuthFetch = { response: globalThis.Response; body: unknown } | { response: null; body: null };
async function authFetch(config: SupabaseConfig, path: string, options: {
  method?: string; body?: unknown; accessToken?: string;
} = {}): Promise<AuthFetch> {
  try {
    const response = await fetch(`${config.url}/auth/v1/${path}`, {
      method: options.method ?? "GET",
      headers: {
        apikey: config.key,
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(10_000),
    });
    let body: unknown = null;
    try { body = await response.json(); } catch { /* Ignore untrusted provider error content. */ }
    return { response, body };
  } catch {
    return { response: null, body: null };
  }
}

function validUser(value: unknown): AuthUser | null {
  if (value === null || typeof value !== "object") return null;
  const user = value as Record<string, unknown>;
  if (typeof user.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id)) return null;
  return { id: user.id, email: typeof user.email === "string" && user.email.length <= 320 ? user.email : null };
}

async function verifyAccess(config: SupabaseConfig, accessToken: string): Promise<{
  user: AuthUser | null; unavailable: boolean;
}> {
  const result = await authFetch(config, "user", { accessToken });
  if (!result.response) return { user: null, unavailable: true };
  if (result.response.ok) return { user: validUser(result.body), unavailable: false };
  return { user: null, unavailable: result.response.status >= 500 || result.response.status === 429 };
}

export async function resolveAuth(req: Request, res: Response): Promise<AuthResolution> {
  const config = supabaseConfig();
  if (!config) return { configured: false, user: null, accessToken: null };
  const access = readCookie(req, ACCESS_COOKIE);
  const refresh = readCookie(req, REFRESH_COOKIE);
  if (!access) return { configured: true, user: null, accessToken: null };
  const verified = await verifyAccess(config, access);
  if (verified.user) return { configured: true, user: verified.user, accessToken: access };
  if (verified.unavailable) return { configured: true, user: null, accessToken: null, unavailable: true };
  if (!refresh) {
    clearSessionCookies(res);
    return { configured: true, user: null, accessToken: null };
  }

  const refreshed = await authFetch(config, "token?grant_type=refresh_token", {
    method: "POST", body: { refresh_token: refresh },
  });
  if (!refreshed.response) return { configured: true, user: null, accessToken: null, unavailable: true };
  if (refreshed.response.status >= 500 || refreshed.response.status === 429) {
    return { configured: true, user: null, accessToken: null, unavailable: true };
  }
  if (!refreshed.response.ok || !refreshed.body || typeof refreshed.body !== "object") {
    clearSessionCookies(res);
    return { configured: true, user: null, accessToken: null };
  }
  const tokens = refreshed.body as Record<string, unknown>;
  if (typeof tokens.access_token !== "string" || typeof tokens.refresh_token !== "string") {
    clearSessionCookies(res);
    return { configured: true, user: null, accessToken: null };
  }
  const renewed = await verifyAccess(config, tokens.access_token);
  if (!renewed.user) {
    if (renewed.unavailable) return { configured: true, user: null, accessToken: null, unavailable: true };
    clearSessionCookies(res);
    return { configured: true, user: null, accessToken: null };
  }
  if (!setSessionCookies(res, tokens.access_token, tokens.refresh_token)) {
    clearSessionCookies(res);
    return { configured: true, user: null, accessToken: null };
  }
  return { configured: true, user: renewed.user, accessToken: tokens.access_token };
}

export type AccountActionResult = { status: number; body: Record<string, unknown> };

export async function accountAction(req: Request, res: Response): Promise<AccountActionResult> {
  if (!hasValidOrigin(req)) return { status: 403, body: { error: "Request origin is not allowed." } };
  if (!rateLimit(req, res, "account", 15)) return { status: 429, body: { error: "Please try again later." } };
  const config = supabaseConfig();
  if (!config) return { status: 503, body: { error: "Account service is not configured." } };
  const body = req.body;
  if (body === null || typeof body !== "object" || Array.isArray(body) ||
      !Object.keys(body).every((key) => ["action", "email", "password", "confirmation"].includes(key)) ||
      typeof body.action !== "string" || !actions.has(body.action)) {
    return { status: 400, body: { error: "Invalid account request." } };
  }
  const action = body.action as string;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (["signin", "signup", "recover"].includes(action) &&
      (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { status: 400, body: { error: "A valid email is required." } };
  }
  if (["signin", "signup", "password", "delete"].includes(action) &&
      (password.length < (["signup", "password"].includes(action) ? 12 : 1) || password.length > 1024)) {
    return { status: 400, body: { error: "A valid password is required." } };
  }

  if (action === "delete") {
    const session = await resolveAuth(req, res);
    if (!session.configured) return { status: 503, body: { error: "Account service is not configured." } };
    if (session.unavailable) return { status: 503, body: { error: "Account service is temporarily unavailable." } };
    if (!session.user) return { status: 401, body: { error: "Authentication is required." } };
    if (req.get("x-falcon-account") && req.get("x-falcon-account") !== session.user.id) {
      return { status: 409, body: { error: "The signed-in account changed.", accountChanged: true } };
    }
    if (body.confirmation !== "DELETE MY ACCOUNT") {
      return { status: 400, body: { error: "Account deletion confirmation is required." } };
    }
    const secret = adminKey();
    if (!secret) return { status: 503, body: { error: "Account deletion is unavailable until secure provider-side deletion is configured." } };
    const reauth = await authFetch(config, "token?grant_type=password", {
      method: "POST", body: { email: session.user.email, password },
    });
    if (!reauth.response) return { status: 503, body: { error: "Account service is temporarily unavailable." } };
    if (reauth.response.status >= 500 || reauth.response.status === 429) {
      return { status: 503, body: { error: "Account service is temporarily unavailable." } };
    }
    const reauthBody = reauth.body as Record<string, unknown> | null;
    if (!reauth.response.ok || typeof reauthBody?.access_token !== "string") {
      return { status: 401, body: { error: "Confirm your current password to delete this account." } };
    }
    const verified = await verifyAccess(config, reauthBody.access_token);
    if (!verified.user || verified.user.id !== session.user.id) {
      return { status: verified.unavailable ? 503 : 401, body: { error: "Unable to confirm account ownership." } };
    }
    try {
      const deleted = await fetch(`${config.url}/auth/v1/admin/users/${encodeURIComponent(session.user.id)}`, {
        method: "DELETE", headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ should_soft_delete: false }), signal: AbortSignal.timeout(10_000),
      });
      if (!deleted.ok) return { status: 503, body: { error: "Unable to delete the account. Please try again later." } };
      clearSessionCookies(res); clearPkceCookie(res);
      return { status: 200, body: { success: true, message: "Account and its cloud financial records deleted. Browser records were not erased." } };
    } catch { return { status: 503, body: { error: "Account service is temporarily unavailable." } }; }
  }

  if (action === "signout") {
    const token = readCookie(req, ACCESS_COOKIE);
    if (token) await authFetch(config, "logout", { method: "POST", accessToken: token });
    clearSessionCookies(res);
    clearPkceCookie(res);
    return { status: 200, body: { success: true } };
  }

  if (action === "recover") {
    if (!emailFlowsConfigured()) return { status: 503, body: { error: "Email recovery redirects are not configured yet." } };
    const flow = beginEmailFlow(res, "recover");
    const result = await authFetch(config, `recover?redirect_to=${encodeURIComponent(flow.redirect)}`, {
      method: "POST", body: { email, code_challenge: flow.challenge, code_challenge_method: "s256" },
    });
    if (!result.response || result.response.status >= 500) {
      clearPkceCookie(res);
      return { status: 503, body: { error: "Account service is temporarily unavailable." } };
    }
    if (result.response.status === 429) {
      clearPkceCookie(res);
      return { status: 429, body: { error: "Please wait before requesting another email." } };
    }
    return { status: 200, body: { success: true, message: "If this request can proceed, check your email. Open the latest link in this same browser within one hour." } };
  }

  if (action === "password") {
    const session = await resolveAuth(req, res);
    if (!session.configured) return { status: 503, body: { error: "Account service is not configured." } };
    if (session.unavailable) return { status: 503, body: { error: "Account service is temporarily unavailable." } };
    if (!session.user || !session.accessToken) return { status: 401, body: { error: "Authentication is required." } };
    if (req.get("x-falcon-account") && req.get("x-falcon-account") !== session.user.id) {
      return { status: 409, body: { error: "The signed-in account changed.", accountChanged: true } };
    }
    const result = await authFetch(config, "user", { method: "PUT", accessToken: session.accessToken, body: { password } });
    if (!result.response) return { status: 503, body: { error: "Account service is temporarily unavailable." } };
    if (!result.response.ok) return { status: 400, body: { error: "Unable to update the password." } };
    return { status: 200, body: { success: true } };
  }

  if (action === "signup" && !emailFlowsConfigured()) return { status: 503, body: { error: "Email confirmation redirects are not configured yet." } };
  const flow = action === "signup" ? beginEmailFlow(res, "signup") : null;
  const path = action === "signin" ? "token?grant_type=password" : `signup?redirect_to=${encodeURIComponent(flow!.redirect)}`;
  const result = await authFetch(config, path, { method: "POST", body: { email, password, ...(flow ? { code_challenge: flow.challenge, code_challenge_method: "s256" } : {}) } });
  if (!result.response) return { status: 503, body: { error: "Account service is temporarily unavailable." } };
  if (result.response.status >= 500) return { status: 503, body: { error: "Account service is temporarily unavailable." } };
  if (result.response.status === 429) return { status: 429, body: { error: "Please try again later." } };
  if (!result.response.ok || !result.body || typeof result.body !== "object") {
    if (action === "signup") return { status: 200, body: { success: true, message: "If registration can proceed, the account provider will continue it." } };
    return { status: 401, body: { error: "Email or password is invalid." } };
  }
  const tokens = result.body as Record<string, unknown>;
  if (typeof tokens.access_token === "string" && typeof tokens.refresh_token === "string") {
    const verified = await verifyAccess(config, tokens.access_token);
    if (!verified.user) {
      return { status: verified.unavailable ? 503 : 401, body: { error: verified.unavailable ? "Account service is temporarily unavailable." : "Unable to authenticate." } };
    }
    if (!setSessionCookies(res, tokens.access_token, tokens.refresh_token)) {
      return { status: 503, body: { error: "Unable to establish a secure session." } };
    }
    clearPkceCookie(res);
    return { status: 200, body: { success: true, user: verified.user } };
  }
  if (action === "signup") {
    return { status: 200, body: { success: true, message: "If registration can proceed, check your email. Open the latest confirmation link in this same browser within one hour." } };
  }
  return { status: 401, body: { error: "Email or password is invalid." } };
}
