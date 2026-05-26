import Link from "next/link";
import { STATES } from "@/lib/types";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-10 px-4 mt-16">
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-8">
        <div>
          <h3 className="text-white font-semibold mb-3">ThriftSpotter</h3>
          <p className="text-sm">
            The most complete directory of thrift shops across the US.
          </p>
        </div>
        <div>
          <h3 className="text-white font-semibold mb-3">Browse</h3>
          <ul className="space-y-2 text-sm">
            {Object.entries(STATES).map(([slug, name]) => (
              <li key={slug}>
                <Link href={`/${slug}`} className="hover:text-white transition">
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-white font-semibold mb-3">Contact</h3>
          <p className="text-sm">hello@thriftspotter.com</p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-gray-800 text-sm text-center">
        © {new Date().getFullYear()} ThriftSpotter. All rights reserved.
      </div>
    </footer>
  );
}
