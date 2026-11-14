import {pct} from '../sites/labels';
export const sharingNames={single:"\u72ec\u4eab",dual:"\u4e24\u5bb6\u5171\u4eab",multi:"\u4e09\u5bb6\u53ca\u4ee5\u4e0a"};
export const bandNames={all:"\u5168\u90e8\u7ad9\u5740",zero:"\u96f6\u7528\u91cf",lower:"\u4f4e\u4f4d",middleLow:"\u4e2d\u4f4e\u4f4d",middleHigh:"\u4e2d\u9ad8\u4f4d",upper:"\u9ad8\u4f4d",decline:"\u4e0b\u964d",stable:"\u5e73\u7a33",growth:"\u589e\u957f",unknown:"\u4e0d\u53ef\u6bd4"};
export const viewItems=[{value:'region',label:"\u533a\u57df\u5206\u6790",icon:'city'},{value:'operators',label:"\u8fd0\u8425\u5546\u5206\u6790",icon:'users'},{value:'cohorts',label:"\u7ad9\u7fa4\u5bf9\u6807",icon:'building'}] as const;
export const groupItems=[{value:'scene',label:"\u4e1a\u52a1\u573a\u666f"},{value:'siteType',label:"\u7ad9\u70b9\u7c7b\u578b"},{value:'sharing',label:"\u5171\u4eab\u65b9\u5f0f"}] as const;
export const signedPercent=(value:number|null)=>value===null?"\u2014":(value>0?"+":"")+pct(value);
