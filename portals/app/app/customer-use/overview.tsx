"use client";
import type {AnalysisHref} from '../site-analysis/workspace';
import {CustomerOccupancy,CustomerSharing,CustomerUsage} from './sections';
import type {CustomerUseModel} from './model';
export default function CustomerOverview({data,href}:{data:CustomerUseModel;href:AnalysisHref}){
 return <div className="flex min-w-0 flex-col gap-2xl"><CustomerOccupancy data={data} href={href}/><CustomerSharing data={data} href={href}/><CustomerUsage data={data} href={href}/></div>;
}
