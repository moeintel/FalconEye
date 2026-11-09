import type { Request, Response } from "express";

export type AuthUser = { id: string; email: string | null };
type SupabaseConfig = { url: string; key: string };
type AuthResolution =
  | { configured: false; user: null; accessToken: null }
  | { configured: true; user: AuthUser | null; accessToken: string | null; unavailable?: boolean };

const ACCESS_COOKIE = "fe_access";
const REFRESH_COOKIE = "fe_refresh";
const buckets = new Map<string, { count: number; until: number }>();
const actions = new Set(["signin", "signup", "signout", "recover", "password", "delete"]);

export function supabaseConfig(): SupabaseConfig | null {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!rawUrl || !key) return null;
  try {
    const parsed = new URL(rawUrl);
    const localHttp = parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) &&
      process.env.NODE_ENV !== "production";
    if ((parsed.protocol !== "https:" && !localHttp) || parsed.username || parsed.password) return null;
    return { url: parsed.origin, key };
  } catch {
    return null;
  }
}

export const authIsConfigured = () => supabaseConfig() !== null;

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
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  // Keep the access cookie present past JWT expiry so the server can validate
  // it, rotate with the refresh token, and never expose tokens to browser JS.
  res.append("Set-Cookie", `${ACCESS_COOKIE}=${encodeURIComponent(access)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);
  res.append("Set-Cookie", `${REFRESH_COOKIE}=${encodeURIComponent(refresh)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);
  return true;
}

export function clearSessionCookies(res: Response): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.append("Set-Cookie", `${ACCESS_COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
  res.append("Set-Cookie", `${REFRESH_COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
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
  return { user: null, unavailable: result.response.status >= 500 };
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
  if (["signin", "signup", "password"].includes(action) &&
      (password.length < 8 || password.length > 1024)) {
    return { status: 400, body: { error: "A valid password is required." } };
  }

  if (action === "delete") {
    const session = await resolveAuth(req, res);
    if (!session.configured) return { status: 503, body: { error: "Account service is not configured." } };
    if (session.unavailable) return { status: 503, body: { error: "Account service is temporarily unavailable." } };
    if (!session.user) return { status: 401, body: { error: "Authentication is required." } };
    if (body.confirmation !== "DELETE MY ACCOUNT") {
      return { status: 400, body: { error: "Account deletion confirmation is required." } };
    }
    return { status: 503, body: { error: "Account deletion is unavailable until secure provider-side deletion is configured." } };
  }

  if (action === "signout") {
    const token = readCookie(req, ACCESS_COOKIE);
    if (token) await authFetch(config, "logout", { method: "POST", accessToken: token });
    clearSessionCookies(res);
    return { status: 200, body: { success: true } };
  }

  if (action === "recover") {
    // Supabase recovery links carry a credential in a browser URL. Until a
    // first-party, fragment-only recovery flow exists, do not issue those links.
    return { status: 503, body: { error: "Secure account recovery is not available yet." } };
  }

  if (action === "password") {
    const session = await resolveAuth(req, res);
    if (!session.configured) return { status: 503, body: { error: "Account service is not configured." } };
    if (session.unavailable) return { status: 503, body: { error: "Account service is temporarily unavailable." } };
    if (!session.user || !session.accessToken) return { status: 401, body: { error: "Authentication is required." } };
    const result = await authFetch(config, "user", { method: "PUT", accessToken: session.accessToken, body: { password } });
    if (!result.response) return { status: 503, body: { error: "Account service is temporarily unavailable." } };
    if (!result.response.ok) return { status: 400, body: { error: "Unable to update the password." } };
    return { status: 200, body: { success: true } };
  }

  const path = action === "signin" ? "token?grant_type=password" : "signup";
  const result = await authFetch(config, path, { method: "POST", body: { email, password } });
  if (!result.response) return { status: 503, body: { error: "Account service is temporarily unavailable." } };
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
    return { status: 200, body: { success: true, user: verified.user } };
  }
  if (action === "signup") {
    return { status: 200, body: { success: true, message: "If registration can proceed, the account provider will continue it." } };
  }
  return { status: 401, body: { error: "Email or password is invalid." } };
}
