import type { MetadataRoute } from "next";
import { unstable_noStore } from "next/cache";
import { sanityFetch } from "@/sanity/lib/fetch";
import { postSlugsQuery } from "@/sanity/lib/queries";

async function getBlogPosts() {
  // Skip Sanity fetch during build with dummy credentials
  if (
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ===
    "dummy-sanity-project-id-for-build"
  ) {
    return []; // Return empty array directly
  }
  const posts = await sanityFetch<{ slug: string; date: string }[]>({
    query: postSlugsQuery,
  });
  return posts.map((post) => ({
    url: `https://www.calldata.app/blog/post/${post.slug}`,
    lastModified: new Date(post.date),
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // to try fix caching issue: https://github.com/vercel/next.js/discussions/56708#discussioncomment-10127496
  unstable_noStore();

  const blogPosts = await getBlogPosts();

  const staticUrls = [
    {
      url: "https://www.calldata.app/",
      priority: 1,
    },
    {
      url: "https://www.calldata.app/bulk-email-unsubscriber",
    },
    {
      url: "https://www.calldata.app/ai-automation",
    },
    {
      url: "https://www.calldata.app/email-analytics",
    },
    {
      url: "https://www.calldata.app/block-cold-emails",
    },
    {
      url: "https://www.calldata.app/privacy",
    },
    {
      url: "https://www.calldata.app/terms",
    },
    {
      url: "https://www.calldata.app/blog",
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 1,
    },
    {
      url: "https://www.calldata.app/blog/post/how-my-open-source-saas-hit-first-on-product-hunt",
    },
    {
      url: "https://www.calldata.app/blog/post/why-build-an-open-source-saas",
    },
    {
      url: "https://www.calldata.app/blog/post/alternatives-to-skiff-mail",
    },
    {
      url: "https://www.calldata.app/blog/post/best-email-unsubscribe-app",
    },
    {
      url: "https://www.calldata.app/blog/post/bulk-unsubscribe-from-emails",
    },
    {
      url: "https://www.calldata.app/blog/post/escape-email-trap-unsubscribe-for-good",
    },
    {
      url: "https://docs.calldata.app/",
    },
    {
      url: "https://docs.calldata.app/introduction",
    },
    {
      url: "https://docs.calldata.app/essentials/email-ai-automation",
    },
    {
      url: "https://docs.calldata.app/essentials/bulk-email-unsubscriber",
    },
    {
      url: "https://docs.calldata.app/essentials/cold-email-blocker",
    },
  ];

  return [...staticUrls, ...blogPosts];
}
