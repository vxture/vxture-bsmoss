"use client";
import { useEffect, useRef, useState } from "react";
import {
  CATEGORY_LABELS,
  CITIES,
  OPERATORS,
  GRAIN_LABELS,
  UNIT_LABELS,
  displayValue,
} from "../domains/preview/presentation.ts";
import type { PreviewData, PreviewRequest } from "../domains/preview/model.ts";
import type { Category, Grain } from "../domains/catalog/registry.ts";
import type { Preference } from "../domains/views/resolve.ts";
const STORAGE = "bsmoss.sample-view.v1";
const statusLabels: Record<string, string> = {
  sample: "\u6837\u4f8b\u6709\u6548",
  partial: "\u90e8\u5206\u6570\u636e",
  not_connected: "\u672a\u63a5\u5165 / \u7c92\u5ea6\u4e0d\u53ef\u7528",
  not_applicable: "\u4e0d\u652f\u6301\u4e3b\u4f53\u62c6\u5206",
  empty: "\u5f53\u524d\u8303\u56f4\u65e0\u6837\u672c",
};
const stateLabels: Record<string, string> = {
  running: "\u8fd0\u884c",
  fault: "\u6545\u969c",
  unknown: "\u672a\u77e5",
};
const unitLabel = (unit: string, code: string) =>
  unit === "count"
    ? code.includes("sms")
      ? "\u6761"
      : "\u6b21"
    : (UNIT_LABELS[unit] ?? unit);
function Icon({
  name,
}: {
  name: "tower" | "grid" | "chart" | "gear" | "arrow" | "close" | "data";
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "tower" ? (
        <>
          <path d="m8 21 4-18 4 18M9 15h6M10 10h4M7 21h10M5 6a10 10 0 0 0 0 7M19 6a10 10 0 0 1 0 7" />
        </>
      ) : name === "grid" ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </>
      ) : name === "chart" ? (
        <>
          <path d="M3 3v18h18M7 16l4-6 4 3 5-8" />
        </>
      ) : name === "gear" ? (
        <>
          <path d="M4 7h16M4 17h16" />
          <circle cx="8" cy="7" r="3" fill="currentColor" />
          <circle cx="16" cy="17" r="3" fill="currentColor" />
        </>
      ) : name === "arrow" ? (
        <path d="m9 5 7 7-7 7" />
      ) : name === "close" ? (
        <path d="m6 6 12 12M6 18 18 6" />
      ) : (
        <>
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" />
        </>
      )}
    </svg>
  );
}
function Chart({ card }: { card: PreviewData["cards"][number] }) {
  const values = card.series.flatMap((p) =>
    p.value === null ? [] : [p.value],
  );
  const max = Math.max(...values, 1) * 1.15;
  const point = (value: number, i: number) => [
    64 + (i / Math.max(card.series.length - 1, 1)) * 820,
    210 - (value / max) * 172,
  ];
  let drawing = "",
    gap = true;
  for (const [i, p] of card.series.entries()) {
    if (p.value === null) {
      gap = true;
      continue;
    }
    const [x, y] = point(p.value, i);
    drawing += (gap ? "M" : "L") + x + "," + y + " ";
    gap = false;
  }
  return (
    <svg
      viewBox="0 0 920 265"
      className="trend-svg"
      role="img"
      aria-label={card.name + "\u6837\u4f8b\u8d8b\u52bf"}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line
            x1="64"
            y1={38 + i * 43}
            x2="884"
            y2={38 + i * 43}
            stroke="#e9eeef"
            strokeDasharray="3 5"
          />
          <text
            x="52"
            y={42 + i * 43}
            textAnchor="end"
            fill="#829191"
            fontSize="11"
          >
            {displayValue(max * (1 - i / 4), card.unit, card.precision)}
          </text>
        </g>
      ))}
      <path
        d={drawing}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      {card.series.map((p, i) =>
        p.value === null ? (
          <text
            key={i}
            x={point(0, i)[0]}
            y="226"
            fill="#b17b28"
            textAnchor="middle"
            fontSize="10"
          >
            {"\u7f3a\u6570"}
          </text>
        ) : (
          <circle
            key={i}
            cx={point(p.value, i)[0]}
            cy={point(p.value, i)[1]}
            r={card.series.length === 1 ? 5 : 2.5}
            fill="var(--accent)"
          >
            <title>
              {p.label +
                " \u00b7 " +
                displayValue(p.value, card.unit, card.precision) +
                " " +
                unitLabel(card.unit, card.code)}
            </title>
          </circle>
        ),
      )}
      {card.series
        .filter((_, i) => i % 4 === 0 || i === card.series.length - 1)
        .map((p) => (
          <text
            key={p.label}
            x={point(0, card.series.indexOf(p))[0]}
            y="250"
            textAnchor="middle"
            fill="#829191"
            fontSize="11"
          >
            {p.label}
          </text>
        ))}
    </svg>
  );
}
export function Preview({ initial }: { initial: PreviewData }) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const sequence = useRef(0);
  const restored = useRef(false);
  async function run(request: PreviewRequest) {
    const id = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/product-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw Error();
      const next = (await response.json()) as PreviewData;
      if (id === sequence.current) setData(next);
      return true;
    } catch {
      if (id === sequence.current)
        setError(
          "\u914d\u7f6e\u672a\u901a\u8fc7\u6821\u9a8c\u6216\u52a0\u8f7d\u5931\u8d25\uff0c\u5df2\u4fdd\u7559\u4e0a\u6b21\u7ed3\u679c\u3002\u53ef\u91cd\u8bd5\u6216\u6062\u590d\u9ed8\u8ba4\u89c6\u56fe\u3002",
        );
      return false;
    } finally {
      if (id === sequence.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.version !== 1 || !Array.isArray(saved.preferences))
          throw Error();
        void run({ ...initial.request, preferences: saved.preferences });
      }
    } catch {
      setError(
        "\u672c\u673a\u4fdd\u5b58\u7684\u504f\u597d\u65e0\u6cd5\u8bfb\u53d6\uff0c\u8bf7\u6062\u590d\u9ed8\u8ba4\u89c6\u56fe\u3002",
      );
    }
  }, [initial]);
  const category = data.request.category;
  const card =
    data.cards.find((c) => c.id === selected) ??
    data.cards.find((c) => c.status === "sample") ??
    data.cards[0];
  const coverage = data.quality.expected
    ? Math.round((data.quality.valid / data.quality.expected) * 1000) / 10
    : null;
  function categoryChange(next: Category) {
    setSelected("");
    void run({ ...data.request, category: next });
  }
  function preference(patch: Preference) {
    const preferences = [...data.request.preferences];
    const index = preferences.findIndex((p) => p.id === patch.id);
    if (index < 0) preferences.push(patch);
    else preferences[index] = { ...preferences[index], ...patch };
    void run({ ...data.request, preferences });
    setNotice("");
  }
  function move(id: string, delta: number) {
    const options = [...data.options].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    );
    const index = options.findIndex((o) => o.id === id);
    const next = index + delta;
    if (next < 0 || next >= options.length) return;
    [options[index], options[next]] = [options[next], options[index]];
    const prefs = new Map(data.request.preferences.map((p) => [p.id, p]));
    options.forEach((o, i) =>
      prefs.set(o.id, { ...prefs.get(o.id), id: o.id, order: i }),
    );
    void run({ ...data.request, preferences: [...prefs.values()] });
    setNotice("");
  }
  function save() {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ version: 1, preferences: data.request.preferences }),
      );
      setNotice(
        "\u5df2\u4fdd\u5b58\u5230\u672c\u673a\u6d4f\u89c8\u5668\u3002\u6b63\u5f0f\u62a5\u544a\u6a21\u677f\u4e0d\u53d7\u5f71\u54cd\u3002",
      );
    } catch {
      setError(
        "\u6d4f\u89c8\u5668\u672a\u5141\u8bb8\u4fdd\u5b58\uff0c\u5f53\u524d\u914d\u7f6e\u4ecd\u53ef\u5728\u672c\u6b21\u8bbf\u95ee\u4e2d\u4f7f\u7528\u3002",
      );
    }
  }
  async function reset() {
    if (await run({ ...data.request, preferences: [] })) {
      try {
        localStorage.setItem(
          STORAGE,
          JSON.stringify({ version: 1, preferences: [] }),
        );
        setNotice(
          "\u5df2\u6062\u590d\u9ed8\u8ba4\u663e\u793a\u914d\u7f6e\u3002",
        );
      } catch {
        setNotice(
          "\u672c\u6b21\u89c6\u56fe\u5df2\u91cd\u7f6e\uff0c\u672c\u673a\u504f\u597d\u672a\u80fd\u66f4\u65b0\u3002",
        );
      }
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Icon name="tower" />
          </div>
          <div>
            <strong>
              {"\u89c2\u6f9c"}
              <span>BS-MOSS</span>
            </strong>
            <small>
              {"\u7ad9\u5740\u591a\u57df\u8fd0\u8425\u76d1\u7ba1"}
            </small>
          </div>
        </div>
        <div className="workspace">
          <span className="status-dot" />
          <div>
            {"\u9655\u897f\u94c1\u5854"}
            <small>
              {
                "\u7701\u7ea7\u5206\u6790\u5de5\u4f5c\u7a7a\u95f4 \u00b7 \u6837\u4f8b"
              }
            </small>
          </div>
          <span className="workspace-code">SX</span>
        </div>
        <div className="nav-heading">{"\u5468\u671f\u5206\u6790"}</div>
        <nav aria-label={"\u4e3b\u5bfc\u822a"}>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c, i) => (
            <button
              key={c}
              aria-label={CATEGORY_LABELS[c]}
              className={category === c ? "nav-item active" : "nav-item"}
              onClick={() => categoryChange(c)}
              disabled={busy}
            >
              <Icon name={i === 0 ? "chart" : i === 1 ? "grid" : "tower"} />
              <span>{CATEGORY_LABELS[c]}</span>
              <span className="nav-number">{"0" + (i + 1)}</span>
            </button>
          ))}
        </nav>
        <div className="nav-heading secondary-label">
          {"\u663e\u793a\u7ba1\u7406"}
        </div>
        <button
          className="nav-item"
          onClick={() => dialog.current?.showModal()}
        >
          <Icon name="gear" />
          <span>{"\u6307\u6807\u4e0e\u89c6\u56fe\u914d\u7f6e"}</span>
        </button>
        <div className="sidebar-bottom">
          <div className="sample-label">
            <span className="status-dot" />
            {"\u6837\u4f8b\u9884\u89c8"}
          </div>
          <p>
            {
              "\u4ec5\u5c55\u793a\u53ef\u9a8c\u8bc1\u7684\u6837\u4f8b\u6d41\u7a0b\uff0c\u5c1a\u672a\u8fde\u63a5\u771f\u5b9e\u6570\u636e\u6765\u6e90\u3002"
            }
          </p>
          <div className="profile">
            <span className="avatar">{"\u89c8"}</span>
            <div>
              {"\u7701\u7ea7\u5206\u6790\u4eba\u5458"}
              <small>{"\u56fa\u5b9a\u6837\u4f8b\u8eab\u4efd"}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            BS-MOSS <span>/</span>
            {"\u5468\u671f\u5206\u6790"}
            <span>/</span>
            <strong>{CATEGORY_LABELS[category]}</strong>
          </div>
          <div className="topbar-meta">
            <span className="preview-tag">SAMPLE</span>
            <span>{"\u5317\u4eac\u65f6\u95f4 UTC+8"}</span>
            <span className="avatar small-avatar">{"\u89c8"}</span>
          </div>
        </header>
        <main className="content" aria-busy={busy}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">MULTI-DOMAIN OBSERVATORY</div>
              <h1>
                {CATEGORY_LABELS[category]}
                <span>{"\u5468\u671f\u5206\u6790"}</span>
              </h1>
              <p>
                {
                  "\u4ece\u4e1a\u52a1\u627f\u8f7d\u5230\u8bbe\u5907\u8fd0\u884c\uff0c\u8ba9\u6bcf\u4e00\u4e2a\u6307\u6807\u6709\u636e\u53ef\u5faa\u3002"
                }
              </p>
            </div>
            <button
              className="button"
              onClick={() => dialog.current?.showModal()}
            >
              <Icon name="gear" />
              {"\u914d\u7f6e\u663e\u793a"}
            </button>
          </div>
          <nav
            className="mobile-category"
            aria-label={"\u6307\u6807\u5206\u7c7b"}
          >
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <button
                key={c}
                disabled={busy}
                aria-pressed={category === c}
                className={category === c ? "active" : ""}
                onClick={() => categoryChange(c)}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </nav>
          <div className="sample-banner">
            <span className="sample-pill">{"\u6837\u4f8b\u6a21\u5f0f"}</span>
            <span>
              {
                "\u5f53\u524d\u4e3a 6 \u4e2a\u865a\u6784\u7ad9\u5740\u7684\u56fa\u5b9a\u65e5\u671f\u6837\u4f8b\uff0c\u4e0e\u9655\u897f\u7ea6 11 \u4e07\u7ad9\u5740\u89c4\u5212\u89c4\u6a21\u5206\u5f00\u5c55\u793a\u3002"
              }
            </span>
            <span className="banner-end">
              {"\u672a\u63a5\u5165\u771f\u5b9e\u6765\u6e90"}
            </span>
          </div>
          <section
            className="filterbar"
            aria-label={"\u5206\u6790\u7b5b\u9009"}
          >
            <label>
              {"\u533a\u57df"}
              <select
                aria-label={"\u533a\u57df"}
                disabled={busy}
                value={data.request.city}
                onChange={(e) =>
                  void run({
                    ...data.request,
                    city: e.target.value as PreviewRequest["city"],
                  })
                }
              >
                {Object.entries(CITIES).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {"\u670d\u52a1\u4e3b\u4f53"}
              <select
                aria-label={"\u670d\u52a1\u4e3b\u4f53"}
                disabled={busy}
                value={data.request.operator}
                onChange={(e) =>
                  void run({
                    ...data.request,
                    operator: e.target.value as PreviewRequest["operator"],
                  })
                }
              >
                {Object.entries(OPERATORS).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="period">
              <span>{"\u5206\u6790\u65e5\u671f"}</span>
              <strong>2026.10.25</strong>
              <span className="tiny-tag">{"\u56fa\u5b9a\u6837\u4f8b"}</span>
            </div>
            <div className="filter-end">
              {busy
                ? "\u6b63\u5728\u66f4\u65b0\u2026"
                : "\u6837\u4f8b\u7248\u672c v1"}
            </div>
          </section>
          {error && (
            <div role="alert" className="error-message">
              {error}
              <button disabled={busy} onClick={() => void reset()}>
                {"\u6062\u590d\u9ed8\u8ba4"}
              </button>
            </div>
          )}
          <div className="section-heading">
            <h2>
              {"\u6307\u6807\u6982\u89c8"}
              <span>{"METRIC OVERVIEW"}</span>
            </h2>
            <span>
              {data.cards.length +
                " \u9879\u663e\u793a \u00b7 " +
                data.stationCount +
                " \u4e2a\u6837\u672c\u7ad9\u5740"}
            </span>
          </div>
          {data.cards.length === 0 ? (
            <div className="empty-state">
              <Icon name="grid" />
              <h3>
                {"\u5f53\u524d\u672a\u663e\u793a\u4efb\u4f55\u6307\u6807"}
              </h3>
              <p>
                {
                  "\u6253\u5f00\u663e\u793a\u914d\u7f6e\uff0c\u9009\u62e9\u9700\u8981\u5173\u6ce8\u7684\u6307\u6807\u3002"
                }
              </p>
              <button
                className="button"
                onClick={() => dialog.current?.showModal()}
              >
                {"\u9009\u62e9\u6307\u6807"}
              </button>
            </div>
          ) : (
            <div className="metric-grid">
              {data.cards.map((c) => (
                <button
                  key={c.id}
                  className={
                    "metric-card " + (c.id === card?.id ? "selected" : "")
                  }
                  onClick={() => setSelected(c.id)}
                  aria-pressed={c.id === card?.id}
                >
                  <div className="metric-label">
                    <span>{c.name}</span>
                    <span
                      className={"metric-dot " + (c.partial ? "amber" : "")}
                    />
                  </div>
                  <div className="metric-value">
                    {c.formatted}
                    <span>
                      {c.states.length
                        ? "\u53f0\u8fd0\u884c / " +
                          data.stationCount +
                          " \u53f0"
                        : unitLabel(c.unit, c.code)}
                    </span>
                  </div>
                  <div
                    className={"metric-status " + (c.partial ? "warning" : "")}
                  >
                    {c.partial
                      ? "\u90e8\u5206\u7a97\u53e3 \u00b7 \u542b\u7f3a\u6570"
                      : statusLabels[c.status]}
                    <span>{GRAIN_LABELS[c.grain]}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {card && (
            <>
              <section className="analysis-panel">
                <div className="panel-heading">
                  <div>
                    <span className="panel-index">01</span>
                    <h2>
                      {card.name}
                      <span>{"\u8d8b\u52bf\u4e0e\u5206\u5e03"}</span>
                    </h2>
                  </div>
                  <div className="panel-meta">
                    <span className="legend-dot" />
                    {"\u5f53\u524d\u6837\u4f8b"}
                    <span className="tiny-tag">{GRAIN_LABELS[card.grain]}</span>
                  </div>
                </div>
                <div className="chart-caption">
                  <span>{card.description}</span>
                  <span>
                    {"\u5355\u4f4d\uff1a" + unitLabel(card.unit, card.code)}
                  </span>
                </div>
                {card.status !== "sample" ? (
                  <div className="empty-state chart-empty">
                    <Icon name="data" />
                    <h3>{statusLabels[card.status]}</h3>
                    <p>
                      {card.status === "not_applicable"
                        ? "\u5171\u4eab\u7ad9\u5740\u53c2\u6570\u6ca1\u6709\u4e3b\u4f53\u5206\u644a\u4f9d\u636e\uff0c\u8bf7\u5207\u6362\u4e3a\u5168\u90e8\u8fd0\u8425\u5546\u67e5\u770b\u3002"
                        : card.status === "empty"
                          ? "\u7b5b\u9009\u8303\u56f4\u5185\u6ca1\u6709\u5339\u914d\u7684\u6837\u672c\u7ad9\u5740\uff0c\u8bf7\u8c03\u6574\u533a\u57df\u6216\u4e3b\u4f53\u3002"
                          : "\u6837\u4f8b\u4ec5\u5177\u5907\u5c0f\u65f6\u4e0e\u65e5\u6570\u636e\uff1b\u77ed\u4fe1\u5c1a\u672a\u63a5\u5165\u3002\u4e0d\u4f1a\u4ee5\u96f6\u503c\u4ee3\u66ff\u672a\u63a5\u5165\u3002"}
                    </p>
                  </div>
                ) : card.states.length ? (
                  <div className="state-distribution">
                    {card.states.map((s) => (
                      <div key={s.key} className={"state-box " + s.key}>
                        <span className="state-indicator" />
                        <span>{stateLabels[s.key]}</span>
                        <strong>
                          {s.count}
                          <small>{" \u53f0"}</small>
                        </strong>
                        <div className="state-track">
                          <span
                            style={{
                              width:
                                (data.stationCount
                                  ? (s.count / data.stationCount) * 100
                                  : 0) + "%",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Chart card={card} />
                )}
                <div className="panel-foot">
                  <span>
                    {card.partial
                      ? "\u7f3a\u5931\u7a97\u53e3\u5728\u8d8b\u52bf\u4e2d\u7559\u7a7a\uff1b\u6982\u89c8\u4ec5\u6c47\u603b\u6709\u6548\u7a97\u53e3\uff0c\u4e0d\u8865\u96f6\u3002"
                      : "\u6309\u56fa\u5b9a\u6837\u4f8b\u7a97\u53e3\u5c55\u793a\uff1b\u6765\u6e90\u7c92\u5ea6\u4e0d\u652f\u6301\u65f6\u4e0d\u751f\u6210\u66f4\u7ec6\u6570\u636e\u3002"}
                  </span>
                  <span>
                    {"\u5b9a\u4e49 v1 \u00b7 \u7ed3\u679c\u4fee\u8ba2 v" +
                      data.revision}
                  </span>
                </div>
              </section>
              <div className="bottom-grid">
                <section className="analysis-panel evidence">
                  <div className="panel-heading">
                    <div>
                      <span className="panel-index">02</span>
                      <h2>
                        {"\u7ad9\u5740\u660e\u7ec6"}
                        <span>{"\u6837\u4f8b\u8bc1\u636e"}</span>
                      </h2>
                    </div>
                    <span className="muted">
                      {data.stationCount + " \u6761"}
                    </span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{"\u7ad9\u5740 / \u6765\u6e90\u6807\u8bc6"}</th>
                          <th>{"\u5f52\u5c5e"}</th>
                          <th>{card.name}</th>
                          <th>{"\u6570\u636e\u72b6\u6001"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {card.evidence.map((row) => (
                          <tr key={row.stationId}>
                            <td>
                              <strong>{row.name}</strong>
                              <small>{row.stationId}</small>
                            </td>
                            <td>
                              {row.city}
                              <small>{row.operator}</small>
                            </td>
                            <td className="numeric">
                              {stateLabels[row.value] ?? row.value}
                              <small>
                                {card.states.length
                                  ? "\u7a97\u53e3\u672b\u72b6\u6001"
                                  : unitLabel(card.unit, card.code)}
                              </small>
                            </td>
                            <td>
                              <span
                                className={
                                  "quality-tag " +
                                  (row.quality === "partial"
                                    ? "warning-tag"
                                    : "")
                                }
                              >
                                {row.quality === "partial"
                                  ? "\u90e8\u5206\u6570\u636e"
                                  : statusLabels[row.quality]}
                              </span>
                              <small>{row.source}</small>
                            </td>
                          </tr>
                        ))}
                        {!card.evidence.length && (
                          <tr>
                            <td colSpan={4} className="no-rows">
                              {"\u5f53\u524d\u8303\u56f4\u65e0\u6837\u672c"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
                <aside className="context-panel">
                  <div className="context-title">
                    <Icon name="data" />
                    <h2>{"\u6570\u636e\u4e0a\u4e0b\u6587"}</h2>
                  </div>
                  <dl>
                    <div>
                      <dt>{"\u6a21\u5f0f"}</dt>
                      <dd>
                        {
                          "\u865a\u6784\u6837\u4f8b \u00b7 \u975e\u7ebf\u4e0a\u76d1\u6d4b"
                        }
                      </dd>
                    </div>
                    <div>
                      <dt>{"\u5206\u6790\u65f6\u95f4\u7a97"}</dt>
                      <dd>{"2026-10-25 [00:00, 24:00)"}</dd>
                    </div>
                    <div>
                      <dt>{"\u6837\u4f8b\u6c34\u4f4d"}</dt>
                      <dd>2026-10-26 08:00 +08:00</dd>
                    </div>
                    <div>
                      <dt>{"\u4e0b\u884c\u7a97\u53e3\u8986\u76d6"}</dt>
                      <dd>
                        {coverage === null
                          ? "\u65e0\u6837\u672c"
                          : coverage + "%"}
                        <small>
                          {data.quality.valid +
                            " / " +
                            data.quality.expected +
                            " \u4e2a\u9884\u671f\u7a97\u53e3"}
                        </small>
                      </dd>
                    </div>
                    <div>
                      <dt>
                        {"\u6307\u6807\u5b9a\u4e49 / \u663e\u793a\u6a21\u677f"}
                      </dt>
                      <dd>{"v1 / v" + data.templateVersion}</dd>
                    </div>
                  </dl>
                  <div className="context-note">
                    {
                      "\u4e09\u7c7b\u6307\u6807\u72ec\u7acb\u7edf\u8ba1\uff1b\u90e8\u5206\u7528\u91cf\u3001\u6bd4\u7387\u4e0e\u8bbe\u5907\u72b6\u6001\u5404\u7528\u5176\u53e3\u5f84\u3002\u4e2a\u4eba\u663e\u793a\u914d\u7f6e\u4e0d\u6539\u53d8\u539f\u59cb\u6837\u4f8b\u6216\u6b63\u5f0f\u62a5\u544a\u3002"
                    }
                  </div>
                </aside>
              </div>
            </>
          )}
          <footer className="page-footer">
            <span>{"GUANLAN \u00b7 BS-MOSS"}</span>
            <span>
              {
                "\u7ecf\u8425\u670d\u52a1 \u00b7 \u8fd0\u8425\u72b6\u6001 \u00b7 \u8fd0\u884c\u53c2\u6570"
              }
            </span>
          </footer>
        </main>
      </div>
      <dialog ref={dialog} className="config-dialog">
        <div className="config-header">
          <div>
            <div className="eyebrow">PERSONAL VIEW</div>
            <h2>{"\u663e\u793a\u914d\u7f6e"}</h2>
            <p>
              {CATEGORY_LABELS[category] +
                " \u00b7 \u672c\u673a\u4e2a\u4eba\u504f\u597d"}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label={"\u5173\u95ed\u663e\u793a\u914d\u7f6e"}
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="config-body">
          <p className="config-tip">
            {
              "\u9009\u62e9\u5173\u6ce8\u7684\u6307\u6807\u3001\u987a\u5e8f\u3001\u5355\u4f4d\u4e0e\u7c92\u5ea6\u3002\u914d\u7f6e\u5373\u65f6\u9884\u89c8\uff0c\u4fdd\u5b58\u540e\u4ec5\u5f71\u54cd\u5f53\u524d\u6d4f\u89c8\u5668\u3002"
            }
          </p>
          {[...data.options]
            .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
            .map((o, i) => (
              <div className="config-row" key={o.id}>
                <div className="config-row-title">
                  <label>
                    <input
                      type="checkbox"
                      disabled={busy}
                      aria-label={"\u663e\u793a" + o.name}
                      checked={o.visible}
                      onChange={(e) =>
                        preference({ id: o.id, visible: e.target.checked })
                      }
                    />
                    <strong>{o.name}</strong>
                  </label>
                  <div>
                    <button
                      className="icon-button"
                      aria-label={"\u4e0a\u79fb" + o.name}
                      disabled={busy || i === 0}
                      onClick={() => move(o.id, -1)}
                    >
                      \u2191
                    </button>
                    <button
                      className="icon-button"
                      aria-label={"\u4e0b\u79fb" + o.name}
                      disabled={busy || i === data.options.length - 1}
                      onClick={() => move(o.id, 1)}
                    >
                      \u2193
                    </button>
                  </div>
                </div>
                <div className="config-selects">
                  <label>
                    {"\u5c55\u793a\u5355\u4f4d"}
                    <select
                      aria-label={o.name + "\u5c55\u793a\u5355\u4f4d"}
                      value={o.unit}
                      disabled={busy}
                      onChange={(e) =>
                        preference({ id: o.id, displayUnit: e.target.value })
                      }
                    >
                      {o.units.map((u) => (
                        <option key={u} value={u}>
                          {unitLabel(u, o.id)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {"\u5206\u6790\u7c92\u5ea6"}
                    <select
                      aria-label={o.name + "\u5206\u6790\u7c92\u5ea6"}
                      value={o.grain}
                      disabled={busy}
                      onChange={(e) =>
                        preference({ id: o.id, grain: e.target.value as Grain })
                      }
                    >
                      {o.grains.map((g) => (
                        <option key={g} value={g}>
                          {GRAIN_LABELS[g]}
                          {g !== "hour" && g !== "day"
                            ? " \u00b7 \u6837\u4f8b\u672a\u63d0\u4f9b"
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          {notice && (
            <p role="status" className="save-notice">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
        </div>
        <div className="config-footer">
          <button
            className="button subtle"
            disabled={busy}
            onClick={() => void reset()}
          >
            {"\u6062\u590d\u9ed8\u8ba4"}
          </button>
          <button className="button primary" disabled={busy} onClick={save}>
            {"\u4fdd\u5b58\u672c\u673a\u504f\u597d"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
