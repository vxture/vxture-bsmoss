import {Suspense} from 'react';
import EntryGate from './view';
export const dynamic='force-dynamic';
export default function Page(){return <Suspense fallback={null}><EntryGate/></Suspense>;}
