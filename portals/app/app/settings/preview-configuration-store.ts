"use client";
import { useCallback, useEffect, useState } from "react";
import { PREVIEW_CONFIGURATION_KEY, readPreviewConfiguration, type PreviewConfiguration, type PreviewStation } from "../domains/management/preview-configuration";
export function usePreviewConfiguration(seed: PreviewConfiguration, stations: PreviewStation[]) {
  const [data, setData] = useState<PreviewConfiguration>(seed), [ready, setReady] = useState(false), [error, setError] = useState("");
  const load = useCallback(() => {
    try { setData(readPreviewConfiguration(localStorage.getItem(PREVIEW_CONFIGURATION_KEY), seed, stations)); setReady(true); setError(""); }
    catch (e) { setReady(false); setError(e instanceof Error ? e.message : "\u672c\u673a\u914d\u7f6e\u65e0\u6cd5\u8bfb\u53d6\u3002"); }
  }, [seed, stations]);
  useEffect(() => { load(); const change = (e: StorageEvent) => { if (e.key === PREVIEW_CONFIGURATION_KEY || e.key === null) load(); }; window.addEventListener("storage", change); return () => window.removeEventListener("storage", change); }, [load]);
  function save(update: (current: PreviewConfiguration) => PreviewConfiguration) {
    // Re-read immediately before saving so editing an old detail cannot quietly
    // overwrite a changed record. Storage failure never reports success.
    const current = readPreviewConfiguration(localStorage.getItem(PREVIEW_CONFIGURATION_KEY), seed, stations);
    const next = update(current);
    try { localStorage.setItem(PREVIEW_CONFIGURATION_KEY, JSON.stringify(next)); }
    catch { throw Error("\u4fdd\u5b58\u5931\u8d25\uff0c\u6d4f\u89c8\u5668\u5b58\u50a8\u4e0d\u53ef\u7528\u6216\u7a7a\u95f4\u4e0d\u8db3\u3002\u8bf7\u4fdd\u7559\u8868\u5355\u5185\u5bb9\u540e\u91cd\u8bd5\u3002"); }
    setData(next); setError("");
  }
  return { data, ready, error, load, save };
}
