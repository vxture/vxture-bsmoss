export const facilities={tower:'\u5854\u4f53',power:'\u4f9b\u7535',storage:'\u50a8\u80fd',meter:'\u8ba1\u91cf',environment:'\u73af\u5883'} as const;
export type Facility=keyof typeof facilities;
