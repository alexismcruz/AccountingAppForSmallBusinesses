import "dotenv/config";
import { writeFileSync } from "fs";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const STATES = [
  { name: "New York", osmName: "New York", adminLevel: "4", slug: "new-york", abbr: "NY" },
  { name: "California", osmName: "California", adminLevel: "4", slug: "california", abbr: "CA" },
];

const SHOP_TAGS = [
  `["shop"="second_hand"]`,
  `["shop"="charity"]`,
  `["shop"="thrift"]`,
  `["shop"="vintage"]`,
  `["second_hand"="yes"]`,
];

function buildQuery(stateName: string, adminLevel: string): string {
  const areaVar = stateName.toLowerCase().replace(/\s+/g, "_");
  const nodeSets = SHOP_TAGS.map(
    (tag) =>
      `  node${tag}["name"](area.${areaVar});\n  way${tag}["name"](area.${areaVar});`
  ).join("\n");

  return `
[out:json][timeout:90];
area["name"="${stateName}"]["admin_level"="${adminLevel}"]->.${areaVar};
(
${nodeSets}
);
out center tags;
`.trim();
}

async function fetchState(stateName: string, adminLevel: string) {
  const query = buildQuery(stateName, adminLevel);
  console.log(`Fetching ${stateName} from Overpass API...`);

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as any;
  console.log(`  → ${data.elements.length} results`);
  return data.elements;
}

function normalizeElement(el: any, stateInfo: (typeof STATES)[0]) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const name = tags.name?.trim();
  if (!name) return null;

  const city =
    tags["addr:city"] ||
    tags["is_in:city"] ||
    tags["addr:town"] ||
    "";

  const address = [
    tags["addr:housenumber"],
    tags["addr:street"],
  ]
    .filter(Boolean)
    .join(" ");

  return {
    osmId: String(el.id),
    name,
    address: address || tags["addr:full"] || "",
    city,
    state: stateInfo.name,
    stateSlug: stateInfo.slug,
    stateAbbr: stateInfo.abbr,
    zip: tags["addr:postcode"] || "",
    phone: tags["phone"] || tags["contact:phone"] || "",
    website: tags["website"] || tags["contact:website"] || "",
    lat: lat ?? null,
    lng: lng ?? null,
    categories: ["Thrift Store"],
    source: "overpass",
  };
}

async function main() {
  const allShops: any[] = [];

  for (const state of STATES) {
    try {
      const elements = await fetchState(state.osmName, state.adminLevel);
      const normalized = elements
        .map((el: any) => normalizeElement(el, state))
        .filter(Boolean);
      console.log(`  → ${normalized.length} valid shops after normalization`);
      allShops.push(...normalized);
      // Be polite to the API
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`Failed to fetch ${state.name}:`, err);
    }
  }

  writeFileSync(
    "scripts/data/overpass-raw.json",
    JSON.stringify(allShops, null, 2)
  );
  console.log(`\nSaved ${allShops.length} total shops to scripts/data/overpass-raw.json`);
}

main().catch(console.error);
