import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { STATES, STATE_ABBR } from "@/lib/types";
import { titleCase } from "@/lib/utils";

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

export async function generateStaticParams() {
  return Object.keys(STATES).map((state) => ({ state }));
}

export default async function StatePage({ params }: Props) {
  const { state } = await params;
  const stateName = STATES[state];
  if (!stateName) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-emerald-700">Home</Link>
        {" / "}
        <span>{stateName}</span>
      </nav>

      <h1 className="text-3xl font-bold mb-2">
        Thrift Shops in {stateName}
      </h1>
      <p className="text-gray-600 mb-8">
        Browse thrift stores and secondhand shops across {stateName} ({STATE_ABBR[state]}).
        Select a city to see local listings.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
        <p className="text-amber-800 font-medium">Listings coming soon</p>
        <p className="text-amber-600 text-sm mt-1">
          We&apos;re currently populating {stateName} shops. Check back shortly.
        </p>
      </div>
    </div>
  );
}
