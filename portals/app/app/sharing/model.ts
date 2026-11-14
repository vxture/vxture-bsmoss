import {siteAnalysisModel} from "../site-analysis/model";
import {sharingSummary} from "../domains/sharing/rules";

export function sharingModel(input:Record<string,string|string[]|undefined>) {
 // Validate the entire input before deriving the independent analysis cohort.
 const details=siteAnalysisModel(input);
 // A table search/count selection must not change the sharing denominator.
 const scope=siteAnalysisModel({...input,search:"",operatorCount:"all",sharing:"all"});
 const summary=sharingSummary(scope.rows);
 const regions=scope.regions.map(region=>({...region,...sharingSummary(scope.rows.filter(row=>scope.query.city==="all"?row.city===region.id:row.county===region.id))}));
 return {...details,summary:scope.summary,regions:scope.regions,sharing:{...summary,regions}};
}
export type SharingModel=ReturnType<typeof sharingModel>;
