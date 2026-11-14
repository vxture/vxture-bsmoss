// Stable product vocabulary. The all option is a query filter, never a class.
export const SITE_TYPES=['ground','rooftop'] as const;
export const SCENES=['urban','hub','industrial','mountain','efficient','shared'] as const;
export const SHARING_TYPES=['single','dual','multi'] as const;
export type SiteType=typeof SITE_TYPES[number];
export type Scene=typeof SCENES[number];
export type SharingType=typeof SHARING_TYPES[number];
export const SITE_TYPE_NAMES={ground:'\u5730\u9762\u7ad9',rooftop:'\u697c\u9762\u7ad9'} as const;
export const SCENE_NAMES={urban:'\u57ce\u533a\u5546\u5708',hub:'\u4ea4\u901a\u67a2\u7ebd',industrial:'\u4ea7\u4e1a\u56ed\u533a',mountain:'\u5c71\u533a\u4fdd\u969c',efficient:'\u80fd\u6548\u89c2\u5bdf',shared:'\u6587\u65c5\u5171\u4eab'} as const;
export const SHARING_NAMES={single:'\u72ec\u4eab\u7ad9\u5740',dual:'\u4e24\u5bb6\u5171\u4eab',multi:'\u4e09\u5bb6\u53ca\u4ee5\u4e0a'} as const;
export function sharingType(operatorCount:number):SharingType|null {
 if(!Number.isSafeInteger(operatorCount)||operatorCount<0||operatorCount>5)throw Error('invalid_operator_count');
 return operatorCount===0?null:operatorCount===1?'single':operatorCount===2?'dual':'multi';
}
