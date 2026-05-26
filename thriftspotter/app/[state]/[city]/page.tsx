import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { STATES } from "@/lib/types";
import { titleCase, slugify } from "@/lib/utils";
import { prisma } from "@/lib/db";
import ShopCard from "@/components/ShopCard";

interface Props {
  params: Promise<{ state: string; city: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, city } = await params;
  const stateName = STATES[state];
  if (!stateName) return {};
  const cityName = titleCase(city);
  return {
    title: `Thrift Shops in ${cityName}, ${stateName}`,
    description: `Find the best thrift stores and consignment shops in ${cityName}, ${stateName}. Addresses, hours, and phone numbers.`,
  };
}

export const dynamic = "force-dynamic";

async function getShops(stateName: string, citySlug: string) {
  try {
    const shops = await prisma.shop.findMany({
      where: { state: stateName, active: true },
      orderBy: [{ featured: "desc" }, { rating: "desc" }, { name: "asc" }],
    });
    return shops.filter((s) => slugify(s.city) === citySlug);
  } catch {
    return [];
  }
}

export default async function CityPage({ params }: Props) {
  const { state, city } = await params;
  const stateName = STATES[state];
  if (!stateName) notFound();

  const shops = await getShops(stateName, city);
  const cityName = shops[0]?.city ?? titleCase(city);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-emerald-700">Home</Link>
        {" / "}
        <Link href={`/${state}`} className="hover:text-emerald-700">{stateName}</Link>
        {" / "}
        <span>{cityName}</span>
      </nav>

      <h1 className="text-3xl font-bold mb-2">
        Thrift Shops in {cityName}, {stateName}
      </h1>
      <p className="text-gray-600 mb-8">
        {shops.length} {shops.length === 1 ? "shop" : "shops"} found in {cityName}.
      </p>

      {shops.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 font-medium">No listings found for {cityName} yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shops.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop as any}
              stateSlug={state}
              citySlug={city}
            />
          ))}
        </div>
      )}
    </div>
  );
}
