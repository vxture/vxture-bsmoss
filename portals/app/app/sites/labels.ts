import { SITE_TYPE_NAMES, SCENE_NAMES } from "../domains/business-parameters/classification";
export const operatorNames: Record<string, string> = { mobile: "\u79fb\u52a8", telecom: "\u7535\u4fe1", unicom: "\u8054\u901a", broadcast: "\u5e7f\u7535", other: "\u5176\u4ed6", all: "\u5168\u90e8\u8fd0\u8425\u5546" };
export const sceneNames: Record<string,string> = SCENE_NAMES;
export const statusNames: Record<string, string> = { normal: "\u6b63\u5e38", warning: "\u5173\u6ce8", critical: "\u5f02\u5e38" };
export const tabNames = { overview: "\u7ad9\u5740\u603b\u89c8", resources: "\u8d44\u6e90\u8bbe\u5907", services: "\u670d\u52a1\u5173\u7cfb", runtime: "\u8fd0\u884c\u72b6\u6001", business: "\u7ecf\u8425\u7528\u91cf", sources: "\u8d44\u6599\u6765\u6e90" };
export const n = (value: number | string, digits = 0) => Number(value).toLocaleString("zh-CN", { maximumFractionDigits: digits });
export const pct = (value: number | null) => value === null ? "\u2014" : n(value * 100, 1) + "%";
export const siteTypeNames = { all: "\u5168\u90e8\u7ad9\u70b9\u7c7b\u578b", ...SITE_TYPE_NAMES };
