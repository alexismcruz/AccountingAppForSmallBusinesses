import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { STATES } from "@/lib/types";
import { titleCase } from "@/lib/utils";
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

export default async function CityPage({ params }: Props) {
  const { state, city } = await params;
  const stateName = STATES[state];
  if (!stateName) notFound();

  const cityName = titleCase(city);

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
        Showing thrift stores and secondhand shops in {cityName}.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
        <p className="text-amber-800 font-medium">Listings coming soon for {cityName}</p>
      </div>
    </div>
  );
}
