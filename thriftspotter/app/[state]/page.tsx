import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { STATES, STATE_ABBR } from "@/lib/types";
import { slugify } from "@/lib/utils";
import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{ state: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const stateName = STATES[state];
  if (!stateName) return {};
  return {
    title: `Thrift Shops in ${stateName}`,
    description: `Browse all thrift stores and consignment shops in ${stateName}. Find locations, hours, and directions.`,
  };
}

export const dynamic = "force-dynamic";

async function getCities(stateName: string) {
  try {
    const rows = await prisma.shop.groupBy({
      by: ["city"],
      where: { state: stateName, active: true },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });
    return rows.map((r) => ({
      city: r.city,
      slug: slugify(r.city),
      count: r._count.id,
    }));
  } catch {
    return [];
  }
}

export default async function StatePage({ params }: Props) {
  const { state } = await params;
  const stateName = STATES[state];
  if (!stateName) notFound();

  const cities = await getCities(stateName);
  const totalShops = cities.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-emerald-700">Home</Link>
        {" / "}
        <span>{stateName}</span>
      </nav>

      <h1 className="text-3xl font-bold mb-2">Thrift Shops in {stateName}</h1>
      <p className="text-gray-600 mb-8">
        {totalShops} thrift stores and secondhand shops across {cities.length} cities
        in {stateName} ({STATE_ABBR[state]}).
      </p>

      {cities.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 font-medium">Listings coming soon</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {cities.map(({ city, slug, count }) => (
            <Link
              key={slug}
              href={`/${state}/${slug}`}
              className="border border-gray-200 rounded-xl p-5 hover:border-emerald-500 hover:shadow-md transition group"
            >
              <h2 className="font-semibold text-lg group-hover:text-emerald-700">
                {city}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {count} {count === 1 ? "shop" : "shops"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
