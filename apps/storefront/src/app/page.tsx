import { Suspense } from "react";
import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { CmsSections } from "../components/cms-sections";
import { HomeSections } from "../components/home-sections";
import { getHomePage } from "../lib/cms";
import {
  fallbackConfig,
  getCategories,
  getFeaturedProducts,
} from "../lib/storefront";
export async function generateMetadata(): Promise<Metadata> {
  try {
  const page = await getHomePage();
  return page
    ? {
        title: page.content.seo?.title || page.content.title,
        description: page.content.seo?.description,
        robots: { index: !page.content.seo?.noIndex },
        ...(page.content.seo?.canonicalUrl
          ? { alternates: { canonical: page.content.seo.canonicalUrl } }
          : {}),
      }
    : {};
  } catch (error) {
    unstable_rethrow(error);
    return { robots: { index: false } };
  }
}
async function Home() {
  const page = await getHomePage();
  if (page)
    return (
      <main id="main" className="cms-page">
        <h1 className="sr-only">{page.content.title}</h1>
        <CmsSections sections={page.content.sections} assets={page.assets} />
      </main>
    );
  const [categories, products] = await Promise.all([
    getCategories(),
    getFeaturedProducts(),
  ]);
  return (
    <HomeSections
      blocks={fallbackConfig.home}
      categories={categories}
      products={products}
    />
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <main id="main" className="container main-content">
          Loading collections…
        </main>
      }
    >
      <Home />
    </Suspense>
  );
}
