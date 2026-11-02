// Adapted from the yucer engineering reference for product bsmoss.
import type { OidcConfig } from "./config";

export interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge?: number;
}

export function sessionCookieOptions(cfg: OidcConfig): CookieOptions {

  const secure = cfg.cookieName.startsWith("__Host-");
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: cfg.sessionTtlSeconds,
  };
}

export function clearCookieOptions(cfg: OidcConfig): CookieOptions {
  return { ...sessionCookieOptions(cfg), maxAge: 0 };
}
