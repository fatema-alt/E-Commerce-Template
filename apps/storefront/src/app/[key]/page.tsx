import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { getCmsPage } from "../../lib/cms";
import { CmsSections } from "../../components/cms-sections";
type Props = { params: Promise<{ key: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
  const page = await getCmsPage((await params).key);
  if (!page) return {};
  const { title, seo } = page.content;
  return {
    title: seo?.title || title,
    description: seo?.description,
    robots: { index: !seo?.noIndex },
    ...(seo?.canonicalUrl
      ? { alternates: { canonical: seo.canonicalUrl } }
      : {}),
  };
  } catch (error) {
    unstable_rethrow(error);
    return { robots: { index: false } };
  }
}
async function Content({ params }: Props) {
  const page = await getCmsPage((await params).key);
  if (!page) notFound();
  return (
    <main id="main" className="cms-page">
      <div className="container">
        <h1>{page.content.title}</h1>
      </div>
      <CmsSections sections={page.content.sections} assets={page.assets} />
    </main>
  );
}
export default function Page(props: Props) {
  return (
    <Suspense
      fallback={
        <main id="main" className="container main-content">
          Loading page…
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
