import type {ReactNode} from 'react';
import {SectionHeader,type IconName} from '@vxture/design-system';

// The DS owns heading semantics and typography. This adapter only reserves the
// same control-height track for custom business icons and the heading text.
export default function SectionHeading({title,icon,iconVisual}:{title:ReactNode;icon?:IconName;iconVisual?:ReactNode}) {
 return <div className="product-section-heading">
  {iconVisual&&<span className="product-section-icon" aria-hidden="true">{iconVisual}</span>}
  <SectionHeader level={2} title={title} icon={iconVisual?undefined:icon} divider={false} className="product-section-title"/>
 </div>;
}
