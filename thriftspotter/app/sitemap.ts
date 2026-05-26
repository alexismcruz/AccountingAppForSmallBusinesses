import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { STATES } from "@/lib/types";
import { slugify } from "@/lib/utils";

export const revalidate = 86400; // 24 hours

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = "https://www.thriftspotter.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "weekly", priority: 1.0 },
    ...Object.keys(STATES).map((state) => ({
      url: `${BASE}/${state}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];

  let shops: { slug: string; city: string; state: string; updatedAt: Date }[] = [];
  try {
    shops = await prisma.shop.findMany({
      where: { active: true },
      select: { slug: true, city: true, state: true, updatedAt: true },
    });
  } catch {
    // DB not available at build time — return static only
    return staticRoutes;
  }

  const stateMap: Record<string, string> = {
    "New York": "new-york",
    California: "california",
  };

  const shopRoutes: MetadataRoute.Sitemap = shops.map((shop) => ({
    url: `${BASE}/${stateMap[shop.state]}/${slugify(shop.city)}/${shop.slug}`,
    lastModified: shop.updatedAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...shopRoutes];
}
