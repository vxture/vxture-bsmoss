// Adapted from the yucer engineering reference for product bsmoss.
export type LoginStateEvent =

  | "no_record"

  | "ended_by_accounts"

  | "check_unavailable"

  | "token_unavailable";

export interface LoginStateNote {
  readonly event: LoginStateEvent;
  readonly at: string;
  readonly detail: string;
}

export interface AuthDropSnapshot {
  readonly counts: Readonly<Record<LoginStateEvent, number>>;
  readonly last: LoginStateNote | null;
}

interface State {
  counts: Record<LoginStateEvent, number>;
  last: LoginStateNote | null;
}

const KEY = "__bsmossLoginStateNotes";

function state(): State {
  const g = globalThis as unknown as Record<string, State | undefined>;
  return (g[KEY] ??= {
    counts: { no_record: 0, ended_by_accounts: 0, check_unavailable: 0, token_unavailable: 0 },
    last: null,
  });
}

export function describeError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; name?: unknown; message?: unknown };
    const code = typeof e.code === "string" ? e.code : typeof e.name === "string" ? e.name : "Error";
    const message = typeof e.message === "string" ? e.message : "";
    return `${code}${message ? `: ${message}` : ""}`.slice(0, 160);
  }
  return String(err).slice(0, 160);
}

export function noteLoginState(event: LoginStateEvent, detail = ""): void {
  const s = state();
  s.counts[event] += 1;
  s.last = { event, at: new Date().toISOString(), detail: detail.slice(0, 160) };
  if (event !== "no_record") {
    console.warn(`[auth] ${event}${detail ? ` - ${detail.slice(0, 160)}` : ""}`);
  }
}

export function authDropSnapshot(): AuthDropSnapshot {
  const s = state();
  return { counts: { ...s.counts }, last: s.last };
}
