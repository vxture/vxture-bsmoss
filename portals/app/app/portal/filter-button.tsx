'use client';
import {forwardRef,type ButtonHTMLAttributes} from 'react';
import {Button,Icon} from '@vxture/design-system';

type FilterButtonProps=Omit<ButtonHTMLAttributes<HTMLButtonElement>,'children'>&{
 count:number;
 label?:string;
};

// Keep the DS outline surface stable; applied filters only accent the label.
const FilterButton=forwardRef<HTMLButtonElement,FilterButtonProps>(function FilterButton({count,label='\u7b5b\u9009',type='button',...props},ref){
 return <Button {...props} ref={ref} type={type} variant="outline" data-filter-active={count>0}>
  <Icon name="faders" size="sm"/>
  <span className={count>0?'text-primary':undefined}>{label}{count>0?' ('+count+')':''}</span>
 </Button>;
});
export default FilterButton;
