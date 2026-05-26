import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { STATES } from "@/lib/types";
import { titleCase, formatPhone, slugify } from "@/lib/utils";
import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{ state: string; city: string; slug: string }>;
}

export const dynamic = "force-dynamic";

async function getShop(slug: string) {
  try {
    return await prisma.shop.findUnique({ where: { slug, active: true } });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShop(slug);
  if (!shop) return {};
  return {
    title: `${shop.name} — Thrift Shop in ${shop.city}, ${shop.state}`,
    description: `${shop.name} is a thrift store in ${shop.city}, ${shop.state}.${shop.address ? ` Located at ${shop.address}.` : ""} Find hours, phone, and directions.`,
  };
}

export default async function ShopPage({ params }: Props) {
  const { state, city, slug } = await params;
  const stateName = STATES[state];
  if (!stateName) notFound();

  const shop = await getShop(slug);
  if (!shop) notFound();

  const hours = shop.hours as Record<string, string> | null;
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-emerald-700">Home</Link>
        {" / "}
        <Link href={`/${state}`} className="hover:text-emerald-700">{stateName}</Link>
        {" / "}
        <Link href={`/${state}/${city}`} className="hover:text-emerald-700">{shop.city}</Link>
        {" / "}
        <span>{shop.name}</span>
      </nav>

      <h1 className="text-3xl font-bold mb-1">{shop.name}</h1>

      {shop.rating && (
        <p className="text-gray-500 mb-4">
          ★ {shop.rating.toFixed(1)}
          {shop.reviewCount && <span> ({shop.reviewCount} reviews)</span>}
        </p>
      )}

      {shop.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {shop.categories.map((cat) => (
            <span key={cat} className="text-sm bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full">
              {cat}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {/* Info card */}
        <div className="border border-gray-200 rounded-xl p-5 space-y-3">
          {shop.address && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Address</p>
              <p className="text-gray-800">{shop.address}</p>
              <p className="text-gray-800">{shop.city}, {shop.state} {shop.zip}</p>
            </div>
          )}
          {shop.phone && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Phone</p>
              <a href={`tel:${shop.phone}`} className="text-emerald-700 hover:underline">
                {formatPhone(shop.phone)}
              </a>
            </div>
          )}
          {shop.website && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Website</p>
              <a
                href={shop.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:underline break-all"
              >
                {shop.website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
        </div>

        {/* Hours card */}
        {hours && (
          <div className="border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Hours</p>
            <div className="space-y-1">
              {DAYS.map((day) => (
                <div key={day} className="flex justify-between text-sm">
                  <span className="text-gray-600">{day}</span>
                  <span className="text-gray-800">{hours[day] || "Closed"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map embed */}
      {shop.lat && shop.lng && (
        <div className="rounded-xl overflow-hidden border border-gray-200 mb-8">
          <iframe
            title={`Map of ${shop.name}`}
            width="100%"
            height="300"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${shop.lng - 0.01},${shop.lat - 0.01},${shop.lng + 0.01},${shop.lat + 0.01}&layer=mapnik&marker=${shop.lat},${shop.lng}`}
          />
        </div>
      )}

      <Link
        href={`/${state}/${city}`}
        className="text-sm text-emerald-700 hover:underline"
      >
        ← Back to {shop.city} thrift shops
      </Link>
    </div>
  );
}
