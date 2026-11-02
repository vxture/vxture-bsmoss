// Adapted from the yucer engineering reference for product bsmoss.
export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string;
  enabled: boolean;
  sessionTtlSeconds: number;
  cookieName: string;
  appOrigin: string;

  authorizeUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  endSessionUrl: string;
}

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function defaultCookieName(): string {
  const explicit = env("RP_SESSION_COOKIE_NAME");
  if (explicit) return explicit;
  return env("NODE_ENV") === "production" ? "__Host-vx_rp_session" : "vx_rp_session";
}

export function getOidcConfig(): OidcConfig {
  const issuer = env("OIDC_ISSUER", "https://accounts.vxture.com").replace(/\/$/, "");
  return {
    issuer,
    clientId: env("OIDC_CLIENT_ID", "bsmoss"),
    clientSecret: env("OIDC_CLIENT_SECRET"),
    redirectUri: env("OIDC_REDIRECT_URI"),
    postLogoutRedirectUri: env("OIDC_POST_LOGOUT_REDIRECT_URI"),
    scopes: env("OIDC_SCOPES", "openid profile email phone"),
    enabled: env("OIDC_RP_ENABLED", "off") === "on" && Boolean(env("OIDC_CLIENT_SECRET").trim()) &&
      Boolean(env("OIDC_REDIRECT_URI").trim()) && Boolean(env("REDIS_URL").trim()) &&
      ["bsmoss","bsmoss-beta"].includes(env("OIDC_CLIENT_ID", "bsmoss")),
    sessionTtlSeconds: Number(env("RP_SESSION_TTL", "2592000")),
    cookieName: defaultCookieName(),
    appOrigin: env("NEXT_PUBLIC_APP_URL", env("OIDC_REDIRECT_URI").replace(/\/(api\/auth\/oidc|auth)\/callback$/, "")),
    authorizeUrl: `${issuer}/oidc/authorize`,
    tokenUrl: `${issuer}/oidc/token`,
    jwksUrl: `${issuer}/oidc/jwks`,
    endSessionUrl: `${issuer}/oidc/end_session`,
  };
}
