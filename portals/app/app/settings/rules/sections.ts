export const RULE_SECTIONS=[
 {value:"monitoring",anchor:"monitoring-parameters",label:"\u8fd0\u884c\u76d1\u6d4b",icon:"waveform"},
 {value:"capacity",anchor:"capacity-parameters",label:"\u627f\u8f7d\u80fd\u529b",icon:"gauge"},
 {value:"verification",anchor:"verification-parameters",label:"\u7528\u91cf\u6838\u9a8c",icon:"search"},
 {value:"other",anchor:"other-rules",label:"\u5176\u4ed6\u89c4\u5219",icon:"list-checks"},
] as const;
export type RuleSection=typeof RULE_SECTIONS[number]["value"];
export const ruleSectionFromHash=(hash:string):RuleSection=>RULE_SECTIONS.find(section=>"#"+section.anchor===hash)?.value??"monitoring";
