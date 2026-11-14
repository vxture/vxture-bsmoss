import { decodeProtectedHeader } from "jose";
import { getOidcConfig, type OidcConfig } from "../auth/lib/config.ts";
import { verifyToken, type KeyResolver } from "../auth/lib/oidc.ts";
import { assertInternalTarget } from "../lib/internal-target.ts";
import { getS2SConfig, type S2SConfig, type FetchLike } from "./s2s.ts";

// Server-only product adapter for the existing platform service-mode profile.
// This proof contains no token, secret, user status or user governance role.
export interface WorkerIdentityProof {
  callerProduct: "bsmoss";
  workspaceId: string;
  expiresAt: number;
  tokenId: string;
}
export type WorkerIdentityProvider = () => Promise<Readonly<WorkerIdentityProof>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 32768, MAX_TOKEN = 16384;
function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

export async function verifyWorkerToken(
  token: string, workspaceId: string, cfg: OidcConfig,
  opts: { keyResolver?: KeyResolver; now?: () => number } = {},
): Promise<Readonly<WorkerIdentityProof>> {
  try {
    if (!UUID.test(workspaceId) || !text(token) || Buffer.byteLength(token) > MAX_TOKEN) throw Error();
    assertInternalTarget(cfg.issuer); assertInternalTarget(cfg.jwksUrl);
    const header = decodeProtectedHeader(token);
    if (header.alg !== "RS256" || !text(header.kid)) throw Error();
    const claims = await verifyToken(token, cfg, {
      audience: "bsmoss", keyResolver: opts.keyResolver, requiredClaims: ["exp", "iat", "jti"],
    });
    const now = (opts.now ?? Date.now)(), act = claims.act;
    if (claims.aud !== "bsmoss" || claims.mode !== "service" || Object.hasOwn(claims, "sub") ||
      !act || typeof act !== "object" || Array.isArray(act) || (act as Record<string, unknown>).sub !== "bsmoss" ||
      claims.workspace_id !== workspaceId || claims.scope !== "tool:bsmoss" ||
      !text(claims.jti) || claims.jti.length > 256 || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
      claims.exp! <= claims.iat! || claims.exp! - claims.iat! > 300 || claims.iat! * 1000 > now + 60000 || claims.exp! * 1000 <= now)
      throw Error();
    return Object.freeze({ callerProduct: "bsmoss", workspaceId, expiresAt: claims.exp! * 1000, tokenId: claims.jti });
  } catch {
    // Never expose JWT payloads, key errors, endpoint bodies or credentials.
    throw Error("worker_identity_invalid");
  }
}

async function boundedJson(response: Response): Promise<unknown> {
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY)) {
    await response.body?.cancel(); throw Error("worker_identity_invalid");
  }
  const reader = response.body?.getReader();
  if (!reader) throw Error("worker_identity_invalid");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw Error("worker_identity_invalid"); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Error("worker_identity_invalid"); }
}

export function createWorkerIdentityProvider(
  workspaceId: string,
  opts: { s2s?: S2SConfig; oidc?: OidcConfig; fetchImpl?: FetchLike; keyResolver?: KeyResolver; now?: () => number } = {},
): WorkerIdentityProvider {
  const cfg = { ...(opts.s2s ?? getS2SConfig()) }, oidc = { ...(opts.oidc ?? getOidcConfig()) };
  const now = opts.now ?? Date.now;
  let cached: Readonly<WorkerIdentityProof> | undefined, flight: Promise<Readonly<WorkerIdentityProof>> | undefined;
  return async () => {
    if (!UUID.test(workspaceId) || !cfg.enabled || !text(cfg.clientSecret) || cfg.productCode !== "bsmoss" ||
      !["bsmoss", "bsmoss-beta"].includes(cfg.clientId)) throw Error("worker_identity_unconfigured");
    if (cached && cached.expiresAt - 30000 > now()) return cached;
    if (!flight) flight = (async () => {
      try {
        const target = assertInternalTarget(cfg.tokenUrl);
        const started = now();
        const body = new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", audience: "bsmoss",
          requested_token_type: "urn:ietf:params:oauth:token-type:access_token", workspace_id: workspaceId,
        });
        const response = await (opts.fetchImpl ?? fetch)(target.toString(), {
          method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json",
            authorization: "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64") },
          body: body.toString(), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) { await response.body?.cancel(); throw Error("worker_identity_unavailable"); }
        const raw = await boundedJson(response);
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("worker_identity_invalid");
        const value = raw as Record<string, unknown>;
        if (!text(value.access_token) || typeof value.token_type !== "string" || value.token_type.toLowerCase() !== "bearer" ||
          typeof value.expires_in !== "number" || !Number.isSafeInteger(value.expires_in) || value.expires_in < 1 || value.expires_in > 300)
          throw Error("worker_identity_invalid");
        const proof = await verifyWorkerToken(value.access_token, workspaceId, oidc, { keyResolver: opts.keyResolver, now });
        const expiresAt = Math.min(proof.expiresAt, started + value.expires_in * 1000);
        if (expiresAt <= now()) throw Error("worker_identity_invalid");
        cached = Object.freeze({ ...proof, expiresAt });
        return cached;
      } catch (error) {
        cached = undefined;
        if (error instanceof Error && error.message === "worker_identity_invalid") throw error;
        throw Error("worker_identity_unavailable");
      }
    })();
    const current = flight;
    try { return await current; }
    finally { if (flight === current) flight = undefined; }
  };
}
