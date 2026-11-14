import {StatusBadge} from '@vxture/design-system';
import type {ReviewCase} from '../domains/usage-verification/demo';
import {kindNames} from './labels';
export function FindingBadge({item}:{item:Pick<ReviewCase,'kind'|'category'>}){return <StatusBadge tone={item.category==='quality'?'warning':item.category==='insufficient'?'neutral':'info'} size="sm">{kindNames[item.kind]}</StatusBadge>;}
