import {beijing,HISTORY_END,historyId,parseHistoryId} from './history-calendar';
import type {SnapshotDescriptor} from './query';

// Demo periods use the frozen source boundary; formal captures use their
// authorized catalog. A reset never derives a data timestamp from wall time.
export function latestPeriodId(current:string,snapshots:readonly SnapshotDescriptor[]):string {
 const period=parseHistoryId(current);
 if(period)return historyId(period.grain,beijing(Date.parse(HISTORY_END)-1));
 return snapshots.filter(s=>!parseHistoryId(s.id)).sort((a,b)=>Date.parse(b.stockAsOf)-Date.parse(a.stockAsOf)
  ||(Date.parse(b.syncedAt??b.publishedAt??'')||0)-(Date.parse(a.syncedAt??a.publishedAt??'')||0)
  ||b.id.localeCompare(a.id))[0]?.id??current;
}
