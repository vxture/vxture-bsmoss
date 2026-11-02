import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default function Home() {
  redirect(process.env.BSMOSS_PRODUCT_PREVIEW === "on" ? "/product-preview" : "/analysis");
}
