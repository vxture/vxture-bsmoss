import { createHash } from "node:crypto";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { validateReportManifest } from "./rules.ts";
import type { PublicationState } from "./publication.ts";
import { assertExportPublication, EXPORT_MAX_BYTES, REPORT_RENDERER_VERSION } from "./exports.ts";

import { reportTime, reportLabels as labels, reportValueText as valueText } from "./display.ts";

const escape = (text: unknown) => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function renderPublishedReport(state: PublicationState): { html: string; sha256: string } {
  assertExportPublication(state);
  const record = state.report, manifest = validateReportManifest(record.manifest), event = state.event;
  if (fingerprintOf(manifest) !== record.manifestSha256 || event.reportRevision !== record.revision || event.manifestSha256 !== record.manifestSha256 || event.reportId !== record.reportId) throw Error("invalid_export_report");
  const sections = manifest.sections.map(section => {
    const panels = manifest.items.filter(item => item.panel.category === section.category).map(item => {
      const main = valueText(item.data, item.panel.displayUnit, item.panel.precision);
      const daily = item.dailyDependencies.map(day => {
        const at = day.data.kind === "not_connected" ? "" : day.data.query.at;
        return "<tr><td>" + escape(at ? reportTime(at) : "") + "</td><td>" + escape(labels[day.status] ?? day.status) + "</td><td>" + escape(valueText(day.data, item.panel.displayUnit, item.panel.precision)) + "</td></tr>";
      }).join("");
      const unit = FIRST_METRICS.get(item.panel.metricRef)!.unit;
      const body = "<h3>" + escape(labels[item.panel.metricRef.code] ?? item.panel.metricRef.code) + "</h3><p class='value'>" + escape(main) + "</p><p>" + escape(labels[item.status] ?? item.status) + " &middot; \u539f\u751f\u5355\u4f4d " + escape(unit) + "</p>" +
        (daily ? "<table><thead><tr><th>\u65f6\u95f4</th><th>\u5b8c\u6574\u6027</th><th>\u503c</th></tr></thead><tbody>" + daily + "</tbody></table>" : "") +
        "<details><summary>\u8ba1\u91cf\u4f9d\u636e\u4e0e\u539f\u59cb\u7cbe\u786e\u503c</summary><pre>" + escape(JSON.stringify({ binding: item.binding, data: item.data, dailyDependencies: item.dailyDependencies }, null, 2)) + "</pre></details>";
      return "<article>" + (item.panel.visible ? body : "<details><summary>" + escape(labels[item.panel.metricRef.code] ?? item.panel.metricRef.code) + " \u00b7 \u6309\u6a21\u677f\u6536\u8d77</summary>" + body + "</details>") + "</article>";
    }).join("");
    return "<section><h2>" + escape(labels[section.category]) + "</h2>" + (panels || "<p>\u672a\u914d\u7f6e</p>") + "</section>";
  }).join("");
  const html = "<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta http-equiv='Content-Security-Policy' content=\"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\"><title>" + escape(manifest.template.definition.title) + "</title><style>" +
    "body{margin:0;background:#eef2f6;color:#172b3d;font:14px/1.6 system-ui,sans-serif}main{max-width:1100px;margin:24px auto;padding:28px;background:white;border-radius:12px}h1{font-size:26px}h2{font-size:20px;border-bottom:1px solid #dbe3ec;padding-bottom:8px}h3{font-size:16px}article{padding:12px 0;border-bottom:1px solid #e8edf2}.value{font-size:20px;color:#075b70;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dbe3ec;padding:8px;text-align:left;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 monospace}summary{cursor:pointer;color:#275a72}footer{font-size:12px;color:#526575;overflow-wrap:anywhere}@media(max-width:700px){main{margin:0;padding:16px;border-radius:0}.value{font-size:17px}td,th{padding:4px}}@media print{body{background:white}main{margin:0;max-width:none}details{break-inside:avoid}}" +
    "</style></head><body><main><header><p>\u5854\u670d\u667a\u5224 BS-MOSS</p><h1>" + escape(manifest.template.definition.title) + "</h1><p>" + escape(reportTime(manifest.period.start)) + " \u2014 " + escape(reportTime(manifest.period.end)) + "</p><p>\u6570\u636e\u5b8c\u6574\u6027\uff1a" + escape(labels[manifest.dataCompleteness]) + " &middot; \u6c34\u4f4d " + escape(reportTime(manifest.watermark)) + "</p></header>" + sections +
    "<footer><p>\u62a5\u544a " + escape(record.reportId) + " &middot; \u751f\u6210\u4fee\u8ba2 " + escape(record.revision) + " &middot; \u53d1\u5e03\u4fee\u8ba2 " + escape(event.eventRevision) + "</p><p>\u751f\u6210 " + escape(reportTime(record.generatedAt)) + " &middot; \u53d1\u5e03 " + escape(reportTime(event.recordedAt)) + "</p><p>\u6a21\u677f " + escape(manifest.template.code) + " @ " + manifest.template.version + "</p><p>SHA256 " + record.manifestSha256 + "</p><p>" + REPORT_RENDERER_VERSION + "</p><p>\u672c\u6587\u4ef6\u4fdd\u7559\u4e0b\u8f7d\u65f6\u6838\u9a8c\u7684\u53d1\u5e03\u5feb\u7167\uff0c\u6700\u65b0\u72b6\u6001\u8bf7\u56de\u5230\u5e73\u53f0\u6838\u9a8c\u3002</p></footer></main></body></html>";
  if (Buffer.byteLength(html, "utf8") > EXPORT_MAX_BYTES) throw Error("export_too_large");
  return { html, sha256: createHash("sha256").update(html).digest("hex") };
}
