// Adapted from the yucer engineering reference for product bsmoss.
export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw) return "/";

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";

  if (/[\x00-\x1f\\]/.test(raw)) return "/";
  return raw;
}
