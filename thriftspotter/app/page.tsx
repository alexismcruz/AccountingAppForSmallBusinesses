import Link from "next/link";
import { STATES } from "@/lib/types";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-emerald-700 text-white py-16 px-4 text-center">
        <h1 className="text-4xl font-bold mb-4">Find Thrift Shops Near You</h1>
        <p className="text-emerald-100 text-lg mb-8 max-w-xl mx-auto">
          The most complete directory of thrift stores, consignment shops, and
          secondhand stores across the US.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {Object.entries(STATES).map(([slug, name]) => (
            <Link
              key={slug}
              href={`/${slug}`}
              className="bg-white text-emerald-700 font-semibold px-8 py-3 rounded-full hover:bg-emerald-50 transition"
            >
              Browse {name}
            </Link>
          ))}
        </div>
      </section>

      {/* Browse by State */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6 text-center">Browse by State</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {Object.entries(STATES).map(([slug, name]) => (
            <Link
              key={slug}
              href={`/${slug}`}
              className="border border-gray-200 rounded-xl p-6 hover:border-emerald-500 hover:shadow-md transition group"
            >
              <h3 className="text-xl font-semibold group-hover:text-emerald-700">
                {name}
              </h3>
              <p className="text-gray-500 mt-1 text-sm">
                Browse all thrift shops in {name}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">About ThriftSpotter</h2>
          <p className="text-gray-600">
            ThriftSpotter is the most complete directory of thrift shops,
            consignment stores, and secondhand shops in the United States. We
            help you discover great deals and sustainable shopping options in
            your neighborhood.
          </p>
        </div>
      </section>
    </>
  );
}
