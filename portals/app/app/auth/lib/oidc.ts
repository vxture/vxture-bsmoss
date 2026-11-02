// Adapted from the yucer engineering reference for product bsmoss.
import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTPayload,
  type KeyLike,
  type JWTVerifyGetKey,
} from "jose";
import type { OidcConfig } from "./config";

const CLOCK_TOLERANCE_SECONDS = 60;

let jwksCache: {
  url: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
} | null = null;

function getJwks(cfg: OidcConfig) {
  if (!jwksCache || jwksCache.url !== cfg.jwksUrl) {
    jwksCache = { url: cfg.jwksUrl, jwks: createRemoteJWKSet(new URL(cfg.jwksUrl)) };
  }
  return jwksCache.jwks;
}

export type KeyResolver = KeyLike | Uint8Array | JWTVerifyGetKey;

export async function verifyToken(
  token: string,
  cfg: OidcConfig,
  opts: { audience?: string; keyResolver?: KeyResolver; requiredClaims?: string[] } = {},
): Promise<JWTPayload> {
  const key: KeyResolver = opts.keyResolver ?? getJwks(cfg);
  const options = {
    issuer: cfg.issuer,
    audience: opts.audience ?? cfg.clientId,
    algorithms: ["RS256"],
    clockTolerance: CLOCK_TOLERANCE_SECONDS,
    requiredClaims: opts.requiredClaims ?? ["exp", "sub"],
  };

  const { payload } =
    typeof key === "function"
      ? await jwtVerify(token, key, options)
      : await jwtVerify(token, key, options);
  return payload;
}

export function accessExpiry(accessToken: string, expiresIn: number | undefined, nowSeconds: number): number {

  const seconds = Number(expiresIn);
  const fromResponse = nowSeconds + (Number.isFinite(seconds) && seconds > 0 ? seconds : 300);
  try {
    const exp = decodeJwt(accessToken).exp;
    return typeof exp === "number" && Number.isFinite(exp) ? Math.min(fromResponse, exp) : fromResponse;
  } catch {
    return fromResponse;
  }
}

export interface TokenSet {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

function basicAuth(cfg: OidcConfig): string {
  return "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
}

export async function exchangeCode(
  cfg: OidcConfig,
  code: string,
  codeVerifier: string,
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    code_verifier: codeVerifier,
  });
  return postToken(cfg, body);
}

export async function refreshTokens(cfg: OidcConfig, refreshToken: string): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return postToken(cfg, body);
}

async function postToken(cfg: OidcConfig, body: URLSearchParams): Promise<TokenSet> {
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: basicAuth(cfg),
      accept: "application/json",
    },
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`token endpoint ${res.status}`);
  }
  return (await res.json()) as TokenSet;
}
