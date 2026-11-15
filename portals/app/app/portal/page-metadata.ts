import type {Metadata} from 'next';
import {towerEntry} from './tower-navigation';

// One module title for list, detail and query-driven views alike.
export function pageMetadata(path:string):Metadata {
 const section=path==='/'?'\u9996\u9875':path==='/entry'?'\u6b22\u8fce':path.startsWith('/settings')?'\u914d\u7f6e\u7ba1\u7406':path.startsWith('/preferences')?'\u4e2a\u4eba\u504f\u597d':towerEntry(path)?.label;
 if(!section)throw new Error('Missing browser title ownership: '+path);
 return {title:{absolute:'BSMOSS \u00b7 '+section}};
}
