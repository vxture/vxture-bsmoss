"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { EChartsType } from "echarts/core";

type Point = { key: string; label: string; value: number };
export default function UsageTrend({ data, formatValue, name, unit }: {
  data: readonly Point[]; formatValue: (value: number) => string; name: string; unit: string;
}) {
  const node = useRef<HTMLDivElement>(null), instance = useRef<EChartsType | null>(null);
  const tokens = useRef<HTMLSpanElement>(null);
  const peak = data.reduce((best, d, i) => d.value > data[best].value ? i : best, 0);
  const [cursor, setCursor] = useState(peak);
  const readout = (index: number) => data[index].label + ":00 " + name + " " + formatValue(data[index].value) + " " + unit;
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    let disposed = false, resize: ResizeObserver | undefined, theme: MutationObserver | undefined;
    void Promise.all([import("echarts/core"), import("echarts/charts"), import("echarts/components"), import("echarts/renderers")]).then(([engine, charts, components, renderers]) => {
      if (disposed) return;
      engine.use([charts.BarChart, components.GridComponent, components.TooltipComponent, renderers.SVGRenderer]);
      const chart = engine.init(element, undefined, { renderer: "svg" });
      instance.current = chart;
      const render = () => {
        const style = getComputedStyle(element), token = (key: string) => style.getPropertyValue(key).trim();
        // Read resolved DS styles: raw token strings can contain rem or calc().
        const measure = getComputedStyle(tokens.current!);
        const inset = parseFloat(measure.paddingTop), small = parseFloat(measure.marginTop), gap = parseFloat(measure.gap);
        chart.setOption({ animation: false,
          textStyle: { fontFamily: style.fontFamily, fontSize: parseFloat(measure.fontSize), color: token("--muted-foreground") },
          grid: { top: inset, right: small, bottom: small, left: 0, containLabel: true },
          tooltip: { trigger: "axis", confine: true, transitionDuration: 0,
            backgroundColor: token("--popover"), borderColor: token("--border"), borderWidth: parseFloat(measure.borderTopWidth),
            padding: [gap, inset],
            textStyle: { color: token("--popover-foreground"), fontSize: parseFloat(measure.fontSize), fontFamily: style.fontFamily },
            axisPointer: { type: "line", lineStyle: { color: token("--chart-axis") } },
            formatter: (params: unknown) => {
              const point = (params as { dataIndex: number }[])[0];
              return point ? readout(point.dataIndex) : "";
            },
          },
          xAxis: { type: "category", data: data.map(d => d.label), axisTick: { show: false },
            axisLine: { lineStyle: { color: token("--chart-axis") } }, axisLabel: { interval: 3, color: token("--muted-foreground"), margin: gap } },
          yAxis: { type: "value", splitNumber: 3, axisLabel: { formatter: formatValue, color: token("--muted-foreground") },
            splitLine: { lineStyle: { color: token("--chart-grid") } } },
          series: [{ type: "bar", name, data: data.map(d => d.value), barCategoryGap: "24%",
            itemStyle: { color: token("--primary"), borderRadius: [parseFloat(measure.borderRadius), parseFloat(measure.borderRadius), 0, 0] },
            emphasis: { itemStyle: { color: token("--primary-hover") } } }],
        });
      };
      render();
      resize = new ResizeObserver(() => { chart.resize(); render(); }); resize.observe(element);
      theme = new MutationObserver(() => { chart.resize(); render(); });
      theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
      chart.on("click", params => { if (typeof params.dataIndex === "number") setCursor(params.dataIndex); });
    });
    return () => { disposed = true; resize?.disconnect(); theme?.disconnect(); instance.current?.dispose(); instance.current = null; };
  }, [data, formatValue, name, unit]);
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    let next = cursor;
    if (event.key === "ArrowRight") next = Math.min(data.length - 1, cursor + 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, cursor - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = data.length - 1;
    else return;
    event.preventDefault(); setCursor(next);
    instance.current?.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: next });
  };
  return <div className="relative flex min-h-0 min-w-0 flex-1 flex-col" role="group" aria-label={"24\u5c0f\u65f6" + name + "\u8d8b\u52bf"}>
    <span ref={tokens} aria-hidden="true" className="pointer-events-none invisible absolute m-xs gap-sm rounded-sm border border-border p-md text-body-small" />
    <div ref={node} className="overview-usage-chart min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="img" tabIndex={0} aria-label={readout(cursor)} onKeyDown={move}
      onBlur={() => instance.current?.dispatchAction({ type: "hideTip" })} />
    <span className="sr-only" aria-live="polite">{readout(cursor)}</span>
  </div>;
}
