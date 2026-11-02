// Adapted from the yucer engineering reference for product bsmoss.
export const REFUSAL_CODES = [

  "NOT_ENTITLED",

  "POLICY_DENIED",

  "APPROVAL_REQUIRED",

  "QUOTA_EXCEEDED",
] as const;
export type RefusalCode = (typeof REFUSAL_CODES)[number];

export interface ErrorEnvelope {
  code: string;
  message: string;
  retryable: boolean;
  field?: string;
}

export function envelope(
  code: string,
  message: string,
  options: { retryable?: boolean; field?: string } = {},
): ErrorEnvelope {
  return {
    code,
    message,

    retryable: options.retryable ?? false,
    ...(options.field ? { field: options.field } : {}),
  };
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  options: { retryable?: boolean; field?: string } = {},
): Response {
  return Response.json(envelope(code, message, options), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function isValidErrorCode(code: string): boolean {

  return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(code);
}

export function violationEnvelope(
  code: string,
  message: string,
  modulePrefix: string,
  retryable?: boolean,
): ErrorEnvelope {
  if (code === "no_product_access" || code === "no_data_access" || code === "feature_not_in_tier") {
    return envelope("NOT_ENTITLED", message, { retryable });
  }
  if (code === "permission_denied") {
    return envelope("POLICY_DENIED", message, { retryable });
  }

  if (code === "quota_exceeded") {
    return envelope("QUOTA_EXCEEDED", message, { retryable });
  }

  return envelope(`${modulePrefix}_${code.toUpperCase()}`, message, { retryable });
}
