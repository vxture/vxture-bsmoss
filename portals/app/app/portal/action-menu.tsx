"use client";
import {ActionMenu as DesignActionMenu} from '@vxture/design-system';
import type {ComponentProps} from 'react';
import './action-menu.css';

// Product-wide sizing adapter; menu behavior remains owned by the DS.
export default function ActionMenu(props:ComponentProps<typeof DesignActionMenu>){
 return <span className="product-row-action"><DesignActionMenu {...props}/></span>;
}
