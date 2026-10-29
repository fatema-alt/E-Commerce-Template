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
async function Home(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await props.searchParams) || {};
  const requestedCount = sp.count ? Number(sp.count) : undefined;
  const page = requestedCount ? null : await getHomePage();
  if (
    page &&
    Array.isArray(page.content?.sections) &&
    page.content.sections.length > 0
  )
    return (
      <main id="main" className="cms-page">
        <h1 className="sr-only">{page.content.title}</h1>
        <CmsSections sections={page.content.sections} assets={page.assets} />
      </main>
    );
  const [allCategories, products] = await Promise.all([
    getCategories(undefined, { includeCounts: true }),
    getFeaturedProducts(),
  ]);
  const categories = requestedCount
    ? allCategories.slice(0, requestedCount)
    : allCategories;
  return (
    <HomeSections
      blocks={fallbackConfig.home}
      categories={categories}
      products={products}
    />
  );
}
export default function Page(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <main id="main" className="container main-content">
          Loading collections…
        </main>
      }
    >
      <Home searchParams={props.searchParams} />
    </Suspense>
  );
}