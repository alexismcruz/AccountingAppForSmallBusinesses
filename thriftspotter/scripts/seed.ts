import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function makeUniqueSlug(base: string, city: string, existing: Set<string>): string {
  let slug = `${slugify(base)}-${slugify(city)}`;
  let attempt = slug;
  let i = 2;
  while (existing.has(attempt)) {
    attempt = `${slug}-${i}`;
    i++;
  }
  existing.add(attempt);
  return attempt;
}

function mergeShops(overpass: any[], yelp: any[]): any[] {
  const merged = new Map<string, any>();

  // Index yelp by yelpId
  for (const shop of yelp) {
    merged.set(`yelp:${shop.yelpId}`, shop);
  }

  // Add overpass shops, skip if very similar name+city already exists
  for (const shop of overpass) {
    const key = `${slugify(shop.name)}-${slugify(shop.city)}`;
    const exists = [...merged.values()].some(
      (s) =>
        slugify(s.name) === slugify(shop.name) &&
        slugify(s.city) === slugify(shop.city)
    );
    if (!exists) {
      merged.set(`osm:${shop.osmId}`, shop);
    }
  }

  return [...merged.values()];
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const overpassPath = "scripts/data/overpass-raw.json";
  const yelpPath = "scripts/data/yelp-raw.json";

  const overpass: any[] = existsSync(overpassPath)
    ? JSON.parse(readFileSync(overpassPath, "utf8"))
    : [];
  const yelp: any[] = existsSync(yelpPath)
    ? JSON.parse(readFileSync(yelpPath, "utf8"))
    : [];

  console.log(`Loaded ${overpass.length} overpass + ${yelp.length} yelp shops`);

  const merged = mergeShops(overpass, yelp);
  console.log(`Merged to ${merged.length} unique shops`);

  // Filter out shops with no city (can't build URL)
  const valid = merged.filter((s) => s.name && s.city && s.state);
  console.log(`${valid.length} shops with required fields`);

  const slugs = new Set<string>();
  let created = 0;
  let skipped = 0;

  for (const shop of valid) {
    const slug = makeUniqueSlug(shop.name, shop.city, slugs);
    try {
      await prisma.shop.upsert({
        where: { slug },
        update: {
          name: shop.name,
          address: shop.address || "",
          city: shop.city,
          state: shop.state,
          zip: shop.zip || null,
          phone: shop.phone || null,
          website: shop.website || null,
          lat: shop.lat,
          lng: shop.lng,
          rating: shop.rating ?? null,
          reviewCount: shop.reviewCount ?? null,
          categories: shop.categories || [],
          yelpId: shop.yelpId || null,
        },
        create: {
          slug,
          name: shop.name,
          address: shop.address || "",
          city: shop.city,
          state: shop.state,
          zip: shop.zip || null,
          phone: shop.phone || null,
          website: shop.website || null,
          lat: shop.lat,
          lng: shop.lng,
          rating: shop.rating ?? null,
          reviewCount: shop.reviewCount ?? null,
          categories: shop.categories || [],
          yelpId: shop.yelpId || null,
        },
      });
      created++;
    } catch (err) {
      skipped++;
    }
  }

  console.log(`\nDone: ${created} upserted, ${skipped} skipped`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
