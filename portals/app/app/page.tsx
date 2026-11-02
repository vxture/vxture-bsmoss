import { redirect } from "next/navigation";
import { BRAND } from "@bsmoss/shared";
export const dynamic = "force-dynamic";
export default function Home() {
  if (process.env.BSMOSS_PRODUCT_PREVIEW === "on") redirect("/product-preview");
  return (
    <main className="landing">
      <span className="eyebrow">BS-MOSS</span>
      <h1>{BRAND.displayName}</h1>
      <p>
        {
          "\u4e1a\u52a1\u95e8\u6237\u5c1a\u672a\u5f00\u653e\uff0c\u6837\u4f8b\u9884\u89c8\u5f53\u524d\u5173\u95ed\u3002"
        }
      </p>
    </main>
  );
}
