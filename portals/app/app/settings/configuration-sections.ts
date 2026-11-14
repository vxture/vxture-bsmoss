import type { IconName } from "@vxture/design-system";
type Section = {title:string;description:string;path:string;icon:IconName;items:{value:string;label:string;icon:IconName}[]};
export const configurationSections = {
  data: {title:"\u6570\u636e\u63a5\u5165",description:"\u7ba1\u7406\u6570\u636e\u6765\u6e90\u3001\u5bf9\u8c61\u6620\u5c04\u4e0e\u6765\u6e90\u7248\u672c",path:"/settings/data-access",icon:"database",items:[{value:"sources",label:"\u6570\u636e\u6765\u6e90",icon:"database"},{value:"mappings",label:"\u5bf9\u8c61\u6620\u5c04",icon:"stack"},{value:"versions",label:"\u6765\u6e90\u7248\u672c",icon:"list-checks"}]},
  access: {title:"\u7ec4\u7ec7\u4e0e\u6743\u9650",description:"\u67e5\u9605\u7ad9\u5740\u7ba1\u8f96\u8303\u56f4\u3001\u6210\u5458\u89d2\u8272\u4e0e\u6570\u636e\u6388\u6743",path:"/settings/access",icon:"shield-check",items:[{value:"jurisdiction",label:"\u7ba1\u8f96\u8303\u56f4",icon:"building"},{value:"members",label:"\u6210\u5458\u6743\u9650",icon:"users"}]},
} satisfies Record<string,Section>;
export type ConfigurationArea=keyof typeof configurationSections;
export function configurationView(area:ConfigurationArea,value:string|string[]|undefined):string {
  return typeof value==="string"&&configurationSections[area].items.some(item=>item.value===value)?value:configurationSections[area].items[0].value;
}
