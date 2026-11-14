"use client";
import { useEffect, useState } from "react";
import { defaultOverviewDisplay, parseOverviewDisplay, OVERVIEW_PREFERENCE_KEY, type OverviewDisplayPreference } from "./metric-catalog";

export function useOverviewDisplay() {
  const [preference, setPreference] = useState(defaultOverviewDisplay), [message, setMessage] = useState("");
  const [invalid, setInvalid] = useState(false), [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(OVERVIEW_PREFERENCE_KEY);
        setPreference(raw ? parseOverviewDisplay(JSON.parse(raw)) : defaultOverviewDisplay());
        setMessage(""); setInvalid(false);
      } catch {
        setPreference(defaultOverviewDisplay());
        setInvalid(true);
        setMessage("\u663e\u793a\u504f\u597d\u4e0d\u53ef\u7528\uff0c\u5df2\u4f7f\u7528\u9ed8\u8ba4\u5e03\u5c40\uff1b\u53ef\u5728\u914d\u7f6e\u7ba1\u7406\u7684\u603b\u89c8\u8bbe\u7f6e\u4e2d\u91cd\u65b0\u4fdd\u5b58\u3002");
      } finally { setReady(true); }
    };
    read();
    const sync = (event: StorageEvent) => { if (event.key === OVERVIEW_PREFERENCE_KEY || event.key === null) read(); };
    window.addEventListener("storage", sync); window.addEventListener("bsmoss-overview-display-change", read);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("bsmoss-overview-display-change", read); };
  }, []);
  const save = (value: OverviewDisplayPreference) => {
    try {
      const valid = parseOverviewDisplay(value);
      localStorage.setItem(OVERVIEW_PREFERENCE_KEY, JSON.stringify(valid));
      setPreference(valid); window.dispatchEvent(new Event("bsmoss-overview-display-change")); setInvalid(false); setMessage("\u5df2\u4fdd\u5b58\u5230\u5f53\u524d\u6d4f\u89c8\u5668\u3002");
      return true;
    } catch { setMessage("\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u6307\u6807\u9009\u62e9\u6216\u6d4f\u89c8\u5668\u5b58\u50a8\u6743\u9650\u3002"); return false; }
  };
  return { preference, message, invalid, ready, save };
}
