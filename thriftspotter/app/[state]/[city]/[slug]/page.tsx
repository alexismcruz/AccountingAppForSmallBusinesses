import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { STATES } from "@/lib/types";
import { titleCase, formatPhone } from "@/lib/utils";

interface Props {
  params: Promise<{ state: string; city: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state, city, slug } = await params;
  const stateName = STATES[state];
  if (!stateName) return {};
  const cityName = titleCase(city);
  const shopName = titleCase(slug);
  return {
    title: `${shopName} — Thrift Shop in ${cityName}, ${stateName}`,
    description: `${shopName} is a thrift store located in ${cityName}, ${stateName}. Get directions, hours, and contact info.`,
  };
}

export default async function ShopPage({ params }: Props) {
  const { state, city, slug } = await params;
  const stateName = STATES[state];
  if (!stateName) notFound();

  const cityName = titleCase(city);
  const shopName = titleCase(slug);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-emerald-700">Home</Link>
        {" / "}
        <Link href={`/${state}`} className="hover:text-emerald-700">{stateName}</Link>
        {" / "}
        <Link href={`/${state}/${city}`} className="hover:text-emerald-700">{cityName}</Link>
        {" / "}
        <span>{shopName}</span>
      </nav>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
        <p className="text-amber-800 font-medium">Shop details coming soon</p>
      </div>
    </div>
  );
}
