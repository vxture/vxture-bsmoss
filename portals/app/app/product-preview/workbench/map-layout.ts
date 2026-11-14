// Floating tools change camera padding, never the map container dimensions.
export function mapInsets(width:number,leftOpen:boolean,detailOpen:boolean,expanded=false,dual=false,areaOpen=false,compareOpen=false,topicOpen=false) {
  const compact=width<760;
  let left=compact?45:topicOpen?466:areaOpen?446:leftOpen?315:65;
  let right=compact?35:compareOpen?Math.min(826,width-156):detailOpen?(expanded?Math.min(906,width-176):dual&&width>=1200?Math.max(320,Math.min(380,width*.25))*2+130:506):65;
  // Preserve a useful camera viewport even when tools occupy most of the display.
  const budget=Math.max(80,width-280);
  if(left+right>budget){left=Math.min(left,65);right=Math.max(35,budget-left);}
  return {top:compact?130:110,bottom:compact?155:145,left,right};
}
