import { cookies } from "next/headers";
import { getOidcConfig } from "../../../auth/lib/config";
import { dataUpdatesForSession } from "../../../domains/access/runtime";
import { updateHttpError } from "../../../domains/data-updates/http";
import { updateListFromUrl } from "../../../domains/data-updates/queries";
import { privateJobResponse } from "../../../domains/supervision/http";
import { errorResponse } from "../../../platform/envelope";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateJobResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  try { return privateJobResponse(Response.json(await dataUpdatesForSession(sid).notifications(updateListFromUrl(new URL(request.url))))); }
  catch (error) { return updateHttpError(error); }
}
