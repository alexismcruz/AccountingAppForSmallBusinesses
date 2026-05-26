import "dotenv/config";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";

const YELP_API_KEY = process.env.YELP_API_KEY;
const BASE_URL = "https://api.yelp.com/v3/businesses/search";

if (!YELP_API_KEY) {
  console.error("Missing YELP_API_KEY in .env");
  process.exit(1);
}

const NY_CITIES = [
  "New York City, NY",
  "Brooklyn, NY",
  "Queens, NY",
  "Bronx, NY",
  "Staten Island, NY",
  "Buffalo, NY",
  "Rochester, NY",
  "Albany, NY",
  "Syracuse, NY",
  "Yonkers, NY",
];

const CA_CITIES = [
  "Los Angeles, CA",
  "San Francisco, CA",
  "San Diego, CA",
  "San Jose, CA",
  "Oakland, CA",
  "Sacramento, CA",
  "Fresno, CA",
  "Long Beach, CA",
  "Bakersfield, CA",
  "Anaheim, CA",
];

async function fetchYelp(location: string, offset = 0): Promise<any[]> {
  const params = new URLSearchParams({
    location,
    categories: "thrift_stores,usedbooks,vintage,consignment",
    limit: "50",
    offset: String(offset),
  });

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: { Authorization: `Bearer ${YELP_API_KEY}` },
  });

  if (res.status === 429) {
    console.log("  Rate limited, waiting 2s...");
    await new Promise((r) => setTimeout(r, 2000));
    return fetchYelp(location, offset);
  }

  if (!res.ok) {
    console.error(`Yelp error for ${location}: ${res.status}`);
    return [];
  }

  const data = (await res.json()) as any;
  return data.businesses || [];
}

async function fetchAllForCity(location: string): Promise<any[]> {
  const first = await fetchYelp(location, 0);
  if (first.length < 50) return first;
  // Yelp caps at 1000 results, max offset 950
  const second = await fetchYelp(location, 50);
  return [...first, ...second];
}

function normalizeYelp(biz: any, stateSlug: string, stateAbbr: string) {
  const loc = biz.location || {};
  return {
    yelpId: biz.id,
    name: biz.name?.trim(),
    address: [loc.address1, loc.address2].filter(Boolean).join(", "),
    city: loc.city || "",
    state: stateSlug === "new-york" ? "New York" : "California",
    stateSlug,
    stateAbbr,
    zip: loc.zip_code || "",
    phone: biz.phone || biz.display_phone || "",
    website: biz.url || "",
    lat: biz.coordinates?.latitude ?? null,
    lng: biz.coordinates?.longitude ?? null,
    rating: biz.rating ?? null,
    reviewCount: biz.review_count ?? null,
    categories: (biz.categories || []).map((c: any) => c.title),
    source: "yelp",
  };
}

async function main() {
  if (!existsSync("scripts/data")) mkdirSync("scripts/data", { recursive: true });

  const allShops: any[] = [];
  const seen = new Set<string>();

  const cityLists = [
    { cities: NY_CITIES, stateSlug: "new-york", abbr: "NY" },
    { cities: CA_CITIES, stateSlug: "california", abbr: "CA" },
  ];

  for (const { cities, stateSlug, abbr } of cityLists) {
    for (const city of cities) {
      console.log(`Fetching Yelp: ${city}...`);
      const businesses = await fetchAllForCity(city);
      let added = 0;
      for (const biz of businesses) {
        if (seen.has(biz.id)) continue;
        seen.add(biz.id);
        const normalized = normalizeYelp(biz, stateSlug, abbr);
        if (normalized.name) {
          allShops.push(normalized);
          added++;
        }
      }
      console.log(`  → ${added} new shops`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  writeFileSync(
    "scripts/data/yelp-raw.json",
    JSON.stringify(allShops, null, 2)
  );
  console.log(`\nSaved ${allShops.length} total shops to scripts/data/yelp-raw.json`);
}

main().catch(console.error);
