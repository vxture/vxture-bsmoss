import { MapPin } from "lucide-react";
import { Spinner } from "@vxture/design-system";
import "./map-loading.css";

export default function MapLoading() {
  return <div className="map-loading-state" role="status" aria-live="polite" aria-busy="true">
    <div className="map-loading-grid" aria-hidden="true" />
    <div className="map-loading-content">
      <div className="map-loading-marker" aria-hidden="true"><MapPin /></div>
      <strong>{"\u6b63\u5728\u5c55\u5f00\u7ad9\u7f51\u5730\u56fe"}</strong>
      <p>{"\u51c6\u5907\u5730\u56fe\u4e0e\u7ad9\u70b9\u56fe\u5c42\uff0c\u8bf7\u7a0d\u5019"}</p>
      <Spinner aria-hidden="true" />
    </div>
  </div>;
}
