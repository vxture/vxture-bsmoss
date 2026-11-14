"use client";
import {useEffect} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {OVERVIEW_DISPLAY_HASH, overviewDisplayHref} from "./overview-display-links";
export default function OverviewDisplayRedirect() {
  const router = useRouter(), params = useSearchParams(), query = params.toString();
  useEffect(() => {
    const redirect = () => {if (window.location.hash === OVERVIEW_DISPLAY_HASH) router.replace(overviewDisplayHref());};
    redirect(); window.addEventListener("hashchange", redirect);
    return () => window.removeEventListener("hashchange", redirect);
  }, [router, query]);
  return null;
}
