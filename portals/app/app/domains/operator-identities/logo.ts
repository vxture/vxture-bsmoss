import sharp from "sharp";
import {MAX_LOGO_BYTES} from "./rules.ts";
// Decode and re-encode uploaded raster images; never persist scripts or metadata.
export async function normalizeLogo(logo:string){
  if(logo.startsWith("/assets/operators/"))return logo;
  try{
    const source=Buffer.from(logo.slice(logo.indexOf(",")+1),"base64");if(source.length>MAX_LOGO_BYTES)throw Error();
    const image=sharp(source,{limitInputPixels:4096*4096,failOn:"warning"}),meta=await image.metadata();
    if(!meta.width||!meta.height||meta.width<16||meta.height<16||meta.width>4096||meta.height>4096||!['png','jpeg','webp'].includes(meta.format??'')||(meta.pages??1)>1)throw Error();
    const encoded=await image.rotate().resize({width:512,height:512,fit:"inside",withoutEnlargement:true}).png().toBuffer();
    if(encoded.length>MAX_LOGO_BYTES)throw Error();
    return "data:image/png;base64,"+encoded.toString("base64");
  }catch{throw Error("invalid_operator_logo");}
}
