import { errorResponse } from "../../platform/envelope.ts";
import { privateReportResponse } from "../reports/http.ts";
export function managementHttpError(error: unknown) {
 const code = error instanceof Error ? error.message : "";
 const status = code === "invalid_management_query" ? 400 : ["identity_required","access_expired"].includes(code) ? 401 : ["feature_denied","permission_denied"].includes(code) ? 403 : ["member_unavailable","source_configuration_unavailable"].includes(code) ? 404 : 503;
 return privateReportResponse(errorResponse(status, status===400?"MANAGEMENT_INVALID_QUERY":status===401?"AUTH_REQUIRED":status===403?"POLICY_DENIED":status===404?(code==="member_unavailable"?"MEMBER_UNAVAILABLE":"SOURCE_CONFIGURATION_UNAVAILABLE"):"MANAGEMENT_UNAVAILABLE", status===400?"Invalid management query":status===401?"Authentication required":status===403?"Access denied":status===404?(code==="member_unavailable"?"Member unavailable":"Source configuration unavailable"):"Management temporarily unavailable"));
}
