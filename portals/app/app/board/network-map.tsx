"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import { Button, Icon, StatusBadge } from "@vxture/design-system";
import type { BoardDemo } from "./model";
import "maplibre-gl/dist/maplibre-gl.css";

export type BoardTheme = "status" | "traffic" | "energy";
function features(points: BoardDemo["snapshot"]["points"]) {
  return { type: "FeatureCollection" as const, features: points.map(point => ({
    type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
    properties: { id: point.id, status: point.status, traffic: point.trafficGiB, energy: point.energyKWh ?? 0 },
  })) };
}
// Canvas data colours resolve the installed DS theme, including its dark mode.
function colour(node: HTMLElement, token: string) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d")!;
  context.fillStyle = getComputedStyle(node).getPropertyValue(token).trim();
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return "rgb(" + r + "," + g + "," + b + ")";
}
export default function NetworkMap({ demo, theme, onPick }: { demo: BoardDemo; theme: BoardTheme; onPick: (id: string) => void }) {
  const node = useRef<HTMLDivElement>(null), map = useRef<maplibregl.Map | null>(null);
  const latest = useRef({ demo, onPick, theme }); latest.current = { demo, onPick, theme };
  const [failed, setFailed] = useState(false), [offline, setOffline] = useState(false);
  const [ready, setReady] = useState(false);
  const [paletteVersion, setPaletteVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setPaletteVersion(value => value + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!node.current) return;
    const host = node.current;
    const c = (token: string) => colour(host, "--" + token);
    let instance: maplibregl.Map;
    try {
      maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
      instance = new maplibregl.Map({ container: host, center: demo.region.center, zoom: 5.8,
        minZoom: 4, maxZoom: 16, attributionControl: false, renderWorldCopies: false,
        style: { version: 8, glyphs: "/geo/fonts/{fontstack}/{range}.pbf", sources: {
          districts: { type: "geojson", data: demo.region.boundaryUrl },
          labels: { type: "geojson", data: { type: "FeatureCollection", features: demo.region.cities.map(city => ({
            type: "Feature", geometry: { type: "Point", coordinates: city.center }, properties: { name: city.name },
          })) } },
          sites: { type: "geojson", data: features(demo.snapshot.points), cluster: true, clusterRadius: 32, clusterMaxZoom: 9,
            clusterProperties: { critical: ["+", ["case", ["==", ["get", "status"], "critical"], 1, 0]],
              warning: ["+", ["case", ["==", ["get", "status"], "warning"], 1, 0]], traffic: ["+", ["get", "traffic"]], energy: ["+", ["get", "energy"]] } },
        }, layers: [
          { id: "background", type: "background", paint: { "background-color": c("background") } },
          { id: "district-fill", type: "fill", source: "districts", paint: { "fill-color": c("primary"), "fill-opacity": 0.09 } },
          { id: "district-line", type: "line", source: "districts", paint: { "line-color": c("primary"), "line-width": 1, "line-opacity": 0.5 } },
          { id: "clusters", type: "circle", source: "sites", filter: ["has", "point_count"],
            paint: { "circle-color": c("primary"), "circle-opacity": 0.75, "circle-radius": ["step", ["get", "point_count"], 9, 20, 14, 100, 20],
              "circle-stroke-color": c("background"), "circle-stroke-width": 2 } },
          { id: "sites", type: "circle", source: "sites", filter: ["!", ["has", "point_count"]],
            paint: { "circle-color": ["match", ["get", "status"], "critical", c("destructive"), "warning", c("warning"), c("success")],
              "circle-radius": 4, "circle-opacity": 0.9, "circle-stroke-color": c("background"), "circle-stroke-width": 1 } },
          { id: "cluster-count", type: "symbol", source: "sites", filter: ["has", "point_count"],
            layout: { "text-field": ["to-string", ["get", "point_count"]], "text-font": ["Open Sans Regular"], "text-size": 11 },
            paint: { "text-color": c("background") } },
          { id: "city-labels", type: "symbol", source: "labels", layout: { "text-field": ["get", "name"],
            "text-font": ["Open Sans Regular"], "text-size": 12, "text-offset": [0, 1.5] },
            paint: { "text-color": c("foreground"), "text-halo-color": c("background"), "text-halo-width": 1 } },
        ] } });
      map.current = instance;
      instance.fitBounds(demo.region.bounds as [number, number, number, number], { padding: 28, duration: 0 });
      instance.on("load", () => { setReady(true); instance.resize(); });
      instance.on("error", () => setOffline(true));
      instance.on("click", "sites", event => { const id = event.features?.[0]?.properties?.id; if (typeof id === "string") latest.current.onPick(id); });
      instance.on("click", "clusters", async event => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const source = instance.getSource("sites") as GeoJSONSource;
        try { const zoom = await source.getClusterExpansionZoom(Number(feature.properties.cluster_id));
          if (map.current === instance) instance.easeTo({ center: feature.geometry.coordinates as [number, number], zoom }); } catch { /* A replaced source needs a fresh click. */ }
      });
      for (const layer of ["sites", "clusters"]) {
        instance.on("mouseenter", layer, () => { instance.getCanvas().style.cursor = "pointer"; });
        instance.on("mouseleave", layer, () => { instance.getCanvas().style.cursor = ""; });
      }
    } catch { setFailed(true); return; }
    const observer = new ResizeObserver(() => instance.resize()); observer.observe(host);
    return () => { observer.disconnect(); map.current = null; instance.remove(); };
    // A server navigation updates the existing map through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!ready || !map.current || !node.current) return;
    const instance = map.current;
    (instance.getSource("sites") as GeoJSONSource)?.setData(features(demo.snapshot.points));
    const c = (name: string) => colour(node.current!, "--" + name);
    instance.setPaintProperty("background", "background-color", c("background"));
    instance.setPaintProperty("district-fill", "fill-color", c("primary"));
    instance.setPaintProperty("district-line", "line-color", c("primary"));
    instance.setPaintProperty("cluster-count", "text-color", c("background"));
    instance.setPaintProperty("city-labels", "text-color", c("foreground"));
    instance.setPaintProperty("city-labels", "text-halo-color", c("background"));
    instance.setPaintProperty("clusters", "circle-stroke-color", c("background"));
    instance.setPaintProperty("sites", "circle-stroke-color", c("background"));
    instance.setPaintProperty("clusters", "circle-color", theme === "status" ?
      ["case", [">", ["get", "critical"], 0], c("destructive"), [">", ["get", "warning"], 0], c("warning"), c("success")] : c(theme === "traffic" ? "primary" : "warning"));
    instance.setPaintProperty("sites", "circle-color", theme === "status" ?
      ["match", ["get", "status"], "critical", c("destructive"), "warning", c("warning"), c("success")] : c(theme === "traffic" ? "primary" : "warning"));
    instance.setPaintProperty("sites", "circle-radius", theme === "status" ? 4 :
      ["interpolate", ["linear"], ["get", theme === "traffic" ? "traffic" : "energy"], 0, 3, theme === "traffic" ? 100 : 20, 12]);
  }, [demo.snapshot.points, ready, theme, paletteVersion]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const bounds = demo.region.counties.find(county => county.id === demo.countyId)?.bounds ?? demo.region.cities.find(city => city.id === demo.cityId)?.bounds ?? demo.region.bounds;
    map.current.fitBounds(bounds as [number, number, number, number], { padding: 28, duration: 500 });
    // Hourly updates preserve the camera; only a region selection refits it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.cityId, demo.countyId, ready]);
  return <div className="relative h-full min-h-0 bg-background">
    <div ref={node} className="board-map-canvas" role="region" aria-label={"\u9655\u897f\u7ad9\u7f51\u5730\u7406\u6001\u52bf"} />
    {(failed || offline) && <div className="absolute left-md top-md"><StatusBadge tone="warning">
      {failed ? "\u5730\u56fe\u5f15\u64ce\u4e0d\u53ef\u7528\uff0c\u53f3\u4fa7\u5730\u5e02\u4e0e\u91cd\u70b9\u7ad9\u5740\u4ecd\u53ef\u67e5\u770b" : "\u8fb9\u754c\u52a0\u8f7d\u5f02\u5e38\uff0c\u7ad9\u5740\u6307\u6807\u4ecd\u53ef\u67e5\u770b"}</StatusBadge></div>}
    {!ready && !failed && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-body-small text-muted-foreground">{"\u7ad9\u7f51\u5730\u56fe\u52a0\u8f7d\u4e2d"}</div>}
    <div className="absolute bottom-md right-md flex flex-col gap-xs" aria-label={"\u51b3\u7b56\u5206\u6790\u5730\u56fe\u64cd\u4f5c"}>
      <Button size="icon-md" variant="secondary" aria-label={"\u590d\u4f4d\u5730\u56fe"} onClick={() => map.current?.fitBounds((demo.region.counties.find(county => county.id === demo.countyId)?.bounds ?? demo.region.cities.find(city => city.id === demo.cityId)?.bounds ?? demo.region.bounds) as [number, number, number, number], { padding: 28 })}><Icon name="target" size="sm" /></Button>
      <Button size="icon-md" variant="secondary" aria-label={"\u653e\u5927\u5730\u56fe"} onClick={() => map.current?.zoomIn()}><Icon name="plus" size="sm" /></Button>
      <Button size="icon-md" variant="secondary" aria-label={"\u7f29\u5c0f\u5730\u56fe"} onClick={() => map.current?.zoomOut()}><Icon name="minus" size="sm" /></Button>
    </div>
  </div>;
}
