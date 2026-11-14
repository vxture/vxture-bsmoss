export const metricNames={power:"\u4f9b\u7535",temperature:"\u6e29\u5ea6",energy:"\u80fd\u8017"};
export const recordNames={all:"\u5168\u90e8",observed:"\u6709\u6570\u636e",missing:"\u5e94\u91c7\u7f3a\u6570",unconnected:"\u672a\u63a5\u5165",unknown:"\u5f85\u786e\u8ba4"};
export const levelNames={normal:"\u672a\u89c1\u5f02\u5e38",warning:"\u9700\u5173\u6ce8",critical:"\u89c4\u5219\u5f02\u5e38",unknown:"\u6570\u636e\u4e0d\u8db3"};
export const signalNames={battery:"\u84c4\u7535\u6c60\u4f9b\u7535",temperature:"\u6e29\u5ea6\u504f\u9ad8",intensity:"\u80fd\u8017\u5f3a\u5ea6\u504f\u9ad8"};
export const filterNames={warning:"\u5f53\u524d\u5173\u6ce8",critical:"\u5f53\u524d\u4e25\u91cd",all:"\u5168\u90e8\u7ad9\u5740",current:"\u5f53\u524d\u9700\u5173\u6ce8\u5408\u8ba1",period:"\u5468\u671f\u5185\u66fe\u5f02\u5e38",data:"\u5f53\u524d\u6570\u636e\u4e0d\u8db3",alarm:"\u672a\u95ed\u73af\u544a\u8b66"};
export const levelTones={normal:"success",warning:"warning",critical:"danger",unknown:"neutral"} as const;
export const localTime=(at:string|null)=>at?new Date(Date.parse(at)+8*3600000).toISOString().slice(0,19).replace("T"," "):"--";
