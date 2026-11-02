// Adapted from the yucer engineering reference for product bsmoss.
import type { OidcConfig } from "./config";
import { toAuthUser, type AuthUser } from "./claims";
import { accessTokenFor, resolveLoginState } from "./login-state";

export interface AuthSession {
  user: AuthUser;

  accessToken: () => Promise<string | null>;
}

export interface ResolveOptions {

  activity: boolean;
}

export async function getAuthUser(
  cfg: OidcConfig,
  rpsid: string,
  opts: ResolveOptions = { activity: false },
): Promise<AuthUser | null> {
  return (await getAuthSession(cfg, rpsid, opts))?.user ?? null;
}

export async function getAuthSession(
  cfg: OidcConfig,
  rpsid: string,
  opts: ResolveOptions = { activity: false },
): Promise<AuthSession | null> {
  const state = await resolveLoginState(cfg, rpsid, opts);
  if (!state) return null;
  let token: Promise<string | null> | null = null;
  return {
    user: toAuthUser(state.claims),

    accessToken: () => (token ??= accessTokenFor(cfg, rpsid)),
  };
}
